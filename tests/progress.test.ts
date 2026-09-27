import { describe, expect, it } from 'vitest';
import { computeGoalProgress, computeProgress, computeProjectProgress, isActionable, isDueToday } from '@/lib/progress';

type Row = { status: string; projectId?: string | null; goalId?: string | null; deferAt?: Date | null; dueAt?: Date | null };

describe('bottom-up progress roll-up', () => {
  it('computes percent from child task completion', () => {
    const tasks = [{ status: 'done' }, { status: 'todo' }, { status: 'done' }, { status: 'doing' }] as never;
    expect(computeProgress(tasks)).toEqual({ total: 4, done: 2, percent: 50 });
  });

  it('returns zero for an empty set instead of NaN', () => {
    expect(computeProgress([])).toEqual({ total: 0, done: 0, percent: 0 });
  });

  it('scopes a project roll-up to its own tasks', () => {
    const rows = [
      { status: 'done', projectId: 'p1' },
      { status: 'todo', projectId: 'p1' },
      { status: 'done', projectId: 'p2' },
    ] as never;
    expect(computeProjectProgress('p1', rows)).toEqual({ total: 2, done: 1, percent: 50 });
    expect(computeProjectProgress('p2', rows)).toEqual({ total: 1, done: 1, percent: 100 });
  });

  it('scopes a goal roll-up to linked tasks', () => {
    const rows = [
      { status: 'done', goalId: 'g1' },
      { status: 'done', goalId: 'g1' },
      { status: 'todo', goalId: 'g2' },
    ] as never;
    expect(computeGoalProgress('g1', rows).percent).toBe(100);
    expect(computeGoalProgress('g2', rows).percent).toBe(0);
  });
});

describe('actionability', () => {
  const now = new Date('2026-03-10T12:00:00.000Z');

  it('treats completed tasks as not actionable', () => {
    expect(isActionable({ status: 'done', deferAt: null }, now)).toBe(false);
  });

  it('defers tasks whose defer date is in the future', () => {
    expect(isActionable({ status: 'todo', deferAt: new Date('2026-04-01T00:00:00Z') } as never, now)).toBe(false);
    expect(isActionable({ status: 'todo', deferAt: new Date('2026-03-01T00:00:00Z') } as never, now)).toBe(true);
  });

  it('detects a same-day due date', () => {
    expect(isDueToday({ dueAt: new Date('2026-03-10T09:00:00') } as never, now)).toBe(true);
    expect(isDueToday({ dueAt: new Date('2026-03-11T09:00:00') } as never, now)).toBe(false);
  });
});

// keep the local Row type referenced so unused-type lint stays quiet
export type _Row = Row;
