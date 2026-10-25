import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { migrateState } from '../shared/game';
import type { UserState } from '../shared/types';

export interface UserRecord {
  state: UserState;
  /** Пользователь запустил бота — ему можно писать. */
  botStarted: boolean;
  leadMagnetSentAt?: number;
  /** Ключ дожима → время отправки. */
  followUps: Record<string, number>;
}

/**
 * Простое файловое хранилище (JSON) с атомарной записью.
 * Для продакшена с большой аудиторией замените на PostgreSQL/Redis — интерфейс Db достаточно реализовать заново.
 */
export class Db {
  private users = new Map<number, UserRecord>();
  private saveTimer: NodeJS.Timeout | undefined;
  private saving: Promise<void> = Promise.resolve();

  constructor(private readonly file: string) {}

  async load() {
    try {
      const raw = JSON.parse(await readFile(this.file, 'utf8')) as Record<string, UserRecord>;
      for (const [id, record] of Object.entries(raw)) {
        const state = migrateState(record.state);
        if (state) this.users.set(Number(id), { ...record, state, followUps: record.followUps ?? {} });
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  get(id: number) {
    return this.users.get(id);
  }

  set(id: number, record: UserRecord) {
    this.users.set(id, record);
    this.scheduleSave();
  }

  all() {
    return this.users.entries();
  }

  private scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.flush(), 500);
  }

  flush() {
    this.saving = this.saving.then(async () => {
      await mkdir(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      await writeFile(tmp, JSON.stringify(Object.fromEntries(this.users)), 'utf8');
      await rename(tmp, this.file);
    });
    return this.saving;
  }
}
