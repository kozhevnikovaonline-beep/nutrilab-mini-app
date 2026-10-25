import { useState } from 'react';
import { SCHOOL, TASKS, type TaskDef } from '@shared/catalog';
import type { UserState } from '@shared/types';
import { useApp } from '../store/appStore';
import { links } from '../lib/config';
import { openLink, shareLink } from '../telegram/webapp';
import { Coin } from './Coin';
import { Icon } from './Icon';

type TaskStatus = 'done' | 'claimable' | 'todo';

function statusOf(task: TaskDef, user: UserState, channelVisited: boolean): TaskStatus {
  if (user.tasks[task.id]) return 'done';
  switch (task.kind) {
    case 'quiz':
      return user.quiz ? 'claimable' : 'todo';
    case 'guide':
      // Награда начисляется при открытии гида (см. GuideScreen).
      return 'todo';
    case 'referral':
      return user.referrals > 0 ? 'claimable' : 'todo';
    case 'channel':
      return channelVisited ? 'claimable' : 'todo';
  }
}

export function TaskList() {
  const user = useApp((s) => s.user)!;
  const run = useApp((s) => s.run);
  const busy = useApp((s) => s.busy);
  const setTab = useApp((s) => s.setTab);
  const push = useApp((s) => s.push);
  const [channelVisited, setChannelVisited] = useState(false);

  const start = (task: TaskDef) => {
    switch (task.kind) {
      case 'quiz':
        setTab('quiz');
        break;
      case 'guide':
        if (user.quiz) push({ name: 'guide' });
        else setTab('quiz');
        break;
      case 'channel':
        openLink(links.channel());
        setChannelVisited(true);
        break;
      case 'referral':
        shareLink(links.referral(user.profile.id), `Проходи тест «Ваш ресурс» в ${SCHOOL.name} и получи гид «Энергия на тарелке» в подарок 🌿`);
        break;
    }
  };

  return (
    <div className="list">
      {TASKS.map((task) => {
        const status = statusOf(task, user, channelVisited);
        const key = `task:${task.id}`;
        return (
          <div key={task.id} className="list-item">
            <div className="list-item__icon">{task.emoji}</div>
            <div className="list-item__body">
              <div className="list-item__title">{task.title}</div>
              <div className="list-item__sub row" style={{ gap: 4 }}>
                <Coin size={14} /> +{task.reward}
              </div>
            </div>
            {status === 'done' ? (
              <span className="check check--on" aria-label="Выполнено">
                <Icon name="check" size={16} strokeWidth={3} />
              </span>
            ) : status === 'claimable' ? (
              <button className="btn btn--lime btn--sm" disabled={busy[key]} onClick={() => run({ type: 'task/claim', taskId: task.id }, key)}>
                {busy[key] ? <span className="spinner" /> : task.kind === 'channel' ? 'Проверить' : 'Забрать'}
              </button>
            ) : (
              <button className="btn btn--ghost btn--sm" onClick={() => start(task)}>
                {task.kind === 'referral' ? 'Пригласить' : 'Начать'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
