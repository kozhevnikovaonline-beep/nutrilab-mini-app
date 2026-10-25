import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { GameError, reduce } from '@shared/game';
import { QUESTION_COUNT } from '@shared/quiz';
import type { ActionResult, AnswerValue, GameAction, UserState } from '@shared/types';
import { api, ApiError } from '../api';
import { haptic, setHapticsEnabled } from '../telegram/webapp';
import { coinWord, formatCoins } from '../lib/format';

export type Tab = 'home' | 'quiz' | 'tap' | 'shop' | 'profile';

export type Route =
  | { name: 'quiz-run' }
  | { name: 'quiz-result' }
  | { name: 'guide' }
  | { name: 'product'; productId: string };

export interface Toast {
  id: number;
  text: string;
  tone: 'success' | 'error' | 'info';
}

interface QuizDraft {
  answers: (AnswerValue | null)[];
  index: number;
}

interface AppStore {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  user: UserState | null;
  tab: Tab;
  stack: Route[];
  toasts: Toast[];
  /** Тапы, учтённые локально, но ещё не подтверждённые сервером. */
  pendingTaps: number;
  busy: Record<string, boolean>;
  settings: { haptics: boolean };
  quizDraft: QuizDraft;

  bootstrap(): Promise<void>;
  setTab(tab: Tab): void;
  push(route: Route): void;
  pop(): void;
  toast(text: string, tone?: Toast['tone']): void;
  dismissToast(id: number): void;
  tap(): number;
  flushTaps(): Promise<void>;
  run(action: GameAction, busyKey?: string): Promise<ActionResult | null>;
  answerQuestion(value: AnswerValue): void;
  goToQuestion(index: number): void;
  resetQuizDraft(): void;
  setHaptics(value: boolean): void;
  resetDemo(): Promise<void>;
}

const emptyDraft = (): QuizDraft => ({ answers: Array(QUESTION_COUNT).fill(null), index: 0 });

const FLUSH_DELAY_MS = 900;
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let flushInFlight: Promise<void> | null = null;
let toastSeq = 0;

const errorMessage = (err: unknown) =>
  err instanceof ApiError || err instanceof GameError ? err.message : 'Что-то пошло не так. Попробуйте ещё раз';

/** Применяет неподтверждённые тапы поверх авторитетного состояния сервера. */
function withPendingTaps(state: UserState, pending: number): UserState {
  if (pending <= 0) return state;
  try {
    return reduce(state, { type: 'taps', count: pending }, { now: Date.now(), genId: () => '' }).state;
  } catch {
    return state;
  }
}

export const useApp = create<AppStore>()(
  persist(
    (set, get) => ({
      status: 'loading',
      error: null,
      user: null,
      tab: 'home',
      stack: [],
      toasts: [],
      pendingTaps: 0,
      busy: {},
      settings: { haptics: true },
      quizDraft: emptyDraft(),

      async bootstrap() {
        set({ status: 'loading', error: null });
        setHapticsEnabled(get().settings.haptics);
        try {
          const user = await api.bootstrap();
          set({ user, status: 'ready' });
        } catch (err) {
          set({ status: 'error', error: errorMessage(err) });
        }
      },

      setTab(tab) {
        if (get().tab !== tab) haptic.select();
        set({ tab, stack: [] });
      },

      push(route) {
        set((s) => {
          const top = s.stack[s.stack.length - 1];
          // Защита от двойного открытия одного и того же экрана (двойной тап).
          if (top && JSON.stringify(top) === JSON.stringify(route)) return s;
          return { stack: [...s.stack, route] };
        });
      },

      pop() {
        set((s) => ({ stack: s.stack.slice(0, -1) }));
      },

      toast(text, tone = 'info') {
        const id = ++toastSeq;
        set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, tone }] }));
        setTimeout(() => get().dismissToast(id), 2600);
      },

      dismissToast(id) {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      },

      tap() {
        const { user } = get();
        if (!user) return 0;
        try {
          const { state, effect } = reduce(user, { type: 'taps', count: 1 }, { now: Date.now(), genId: () => '' });
          set((s) => ({ user: state, pendingTaps: s.pendingTaps + 1 }));
          haptic.tap();
          clearTimeout(flushTimer);
          flushTimer = setTimeout(() => void get().flushTaps(), FLUSH_DELAY_MS);
          return effect.coins ?? 0;
        } catch {
          haptic.warning();
          return 0;
        }
      },

      async flushTaps() {
        if (flushInFlight) return flushInFlight;
        const count = get().pendingTaps;
        if (count <= 0) return;
        set({ pendingTaps: 0 });

        flushInFlight = (async () => {
          try {
            const { state } = await api.dispatch({ type: 'taps', count });
            set((s) => ({ user: withPendingTaps(state, s.pendingTaps) }));
          } catch (err) {
            if (err instanceof ApiError && (err.code === 'NETWORK' || err.code === 'TIMEOUT')) {
              // Вернём тапы в очередь и попробуем позже.
              set((s) => ({ pendingTaps: s.pendingTaps + count }));
              clearTimeout(flushTimer);
              flushTimer = setTimeout(() => void get().flushTaps(), 5_000);
            } else {
              // Сервер отклонил пакет — синхронизируемся с его состоянием.
              const user = await api.bootstrap().catch(() => null);
              if (user) set({ user, pendingTaps: 0 });
            }
          } finally {
            flushInFlight = null;
          }
        })();
        return flushInFlight;
      },

      async run(action, busyKey = action.type) {
        if (get().busy[busyKey]) return null;
        set((s) => ({ busy: { ...s.busy, [busyKey]: true } }));
        try {
          clearTimeout(flushTimer);
          await get().flushTaps();
          const result = await api.dispatch(action);
          set((s) => ({ user: withPendingTaps(result.state, s.pendingTaps) }));
          if (result.effect.coins) {
            haptic.success();
            get().toast(`+${formatCoins(result.effect.coins)} ${coinWord(result.effect.coins)}`, 'success');
          }
          return result;
        } catch (err) {
          haptic.error();
          get().toast(errorMessage(err), 'error');
          return null;
        } finally {
          set((s) => ({ busy: { ...s.busy, [busyKey]: false } }));
        }
      },

      answerQuestion(value) {
        haptic.select();
        set((s) => {
          const answers = [...s.quizDraft.answers];
          answers[s.quizDraft.index] = value;
          return { quizDraft: { ...s.quizDraft, answers } };
        });
      },

      goToQuestion(index) {
        set((s) => ({ quizDraft: { ...s.quizDraft, index: Math.max(0, Math.min(QUESTION_COUNT - 1, index)) } }));
      },

      resetQuizDraft() {
        set({ quizDraft: emptyDraft() });
      },

      setHaptics(value) {
        setHapticsEnabled(value);
        set({ settings: { haptics: value } });
      },

      async resetDemo() {
        if (!api.reset) return;
        clearTimeout(flushTimer);
        const user = await api.reset();
        set({ user, pendingTaps: 0, quizDraft: emptyDraft(), stack: [], tab: 'home' });
        get().toast('Прогресс сброшен', 'info');
      },
    }),
    {
      name: 'nutrilab:ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ settings: s.settings, quizDraft: s.quizDraft }),
      merge: (persisted, current) => {
        const p = persisted as Partial<AppStore> | undefined;
        const draft = p?.quizDraft;
        const validDraft =
          draft && Array.isArray(draft.answers) && draft.answers.length === QUESTION_COUNT ? draft : emptyDraft();
        return { ...current, settings: p?.settings ?? current.settings, quizDraft: validDraft };
      },
    },
  ),
);

// Не теряем тапы при сворачивании/закрытии приложения.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void useApp.getState().flushTaps();
  });
}
