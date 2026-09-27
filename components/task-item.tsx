import { setTaskStatusAction, deleteTaskAction } from '@/app/actions/tasks';
import type { Task } from '@/db/schema';
import type { Dict } from '@/lib/i18n/dictionaries';
import { formatDateTime } from '@/lib/format';
import type { Locale } from '@/lib/i18n/dictionaries';

const PRIORITY_LABEL = ['P3', 'P2', 'P1', 'P0'];

export function TaskItem({
  task,
  dict,
  locale,
  projectName,
}: {
  task: Task;
  dict: Dict;
  locale: Locale;
  projectName?: string;
}) {
  const done = task.status === 'done';
  const overdue = !done && task.dueAt && new Date(task.dueAt).getTime() < Date.now();

  return (
    <li className="flex items-start gap-3 border-b border-line py-3 last:border-0">
      <form action={setTaskStatusAction}>
        <input type="hidden" name="id" value={task.id} />
        <input type="hidden" name="status" value={done ? 'todo' : 'done'} />
        <button
          type="submit"
          aria-label={done ? dict.reopen : dict.markDone}
          className={`mt-0.5 grid h-5 w-5 place-items-center rounded-md border text-xs ${
            done ? 'border-brand-600 bg-brand-600 text-white' : 'border-line text-transparent hover:border-brand-400'
          }`}
        >
          ✓
        </button>
      </form>

      <div className="min-w-0 flex-1">
        <p className={`text-sm ${done ? 'text-muted line-through' : 'text-ink'}`}>{task.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
          <span className="chip">{dict[`status${task.status === 'todo' ? 'Todo' : task.status === 'doing' ? 'Doing' : 'Done'}` as keyof Dict]}</span>
          {task.priority > 1 && <span className="chip">{PRIORITY_LABEL[task.priority]}</span>}
          <span className="chip">
            {dict[`energy${task.energy === 'deep' ? 'Deep' : task.energy === 'light' ? 'Light' : 'Admin'}` as keyof Dict]}
          </span>
          {task.dueAt && (
            <span className={overdue ? 'text-red-600' : ''}>
              {dict.dueDate}: {formatDateTime(task.dueAt, locale)}
            </span>
          )}
          {projectName && <span className="chip">{projectName}</span>}
        </div>
      </div>

      <form action={deleteTaskAction}>
        <input type="hidden" name="id" value={task.id} />
        <button type="submit" className="text-xs text-muted hover:text-red-600" aria-label={dict.delete}>
          ✕
        </button>
      </form>
    </li>
  );
}
