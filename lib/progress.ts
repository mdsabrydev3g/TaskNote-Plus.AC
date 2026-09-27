import type { Task } from '@/db/schema';

export type Progress = {
  total: number;
  done: number;
  percent: number;
};

/**
 * Bottom-up roll-up: project/goal progress is derived from child task
 * completion, never stored as an independently editable number.
 */
export function computeProgress(tasks: Pick<Task, 'status'>[]): Progress {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, done, percent };
}

export function computeProjectProgress(
  projectId: string,
  tasks: Pick<Task, 'status' | 'projectId'>[],
): Progress {
  return computeProgress(tasks.filter((t) => t.projectId === projectId));
}

export function computeGoalProgress(
  goalId: string,
  tasks: Pick<Task, 'status' | 'goalId'>[],
): Progress {
  return computeProgress(tasks.filter((t) => t.goalId === goalId));
}

/** Ready-to-work set: not done, not deferred into the future. */
export function isActionable(task: Pick<Task, 'status' | 'deferAt'>, now: Date = new Date()): boolean {
  if (task.status === 'done') return false;
  if (task.deferAt && new Date(task.deferAt).getTime() > now.getTime()) return false;
  return true;
}

export function isDueToday(task: Pick<Task, 'dueAt'>, now: Date = new Date()): boolean {
  if (!task.dueAt) return false;
  const due = new Date(task.dueAt);
  return (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()
  );
}
