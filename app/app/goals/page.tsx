import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { goals, tasks } from '@/db/schema';
import { requireSession } from '@/lib/auth/current';
import { getTranslator } from '@/lib/i18n';
import { dictionaries } from '@/lib/i18n/dictionaries';
import { deleteGoalAction, saveGoalAction } from '@/app/actions/goals';
import { computeGoalProgress } from '@/lib/progress';
import { ProgressBar } from '@/components/progress-bar';
import { formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function GoalsPage() {
  const session = await requireSession();
  const { locale } = await getTranslator();
  const dict = dictionaries[locale];

  const goalRows = await db()
    .select()
    .from(goals)
    .where(eq(goals.workspaceId, session.workspaceId))
    .orderBy(desc(goals.createdAt));

  const taskRows = await db()
    .select({ id: tasks.id, status: tasks.status, goalId: tasks.goalId })
    .from(tasks)
    .where(eq(tasks.workspaceId, session.workspaceId));

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold">{dict.goals}</h1>
      </header>

      <section className="card">
        <h2 className="mb-3 text-sm font-semibold">{dict.newGoal}</h2>
        <form action={saveGoalAction} className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="title">
              {dict.title}
            </label>
            <input id="title" name="title" className="input" required maxLength={200} />
          </div>
          <div>
            <label className="label" htmlFor="targetAt">
              {dict.dueDate}
            </label>
            <input id="targetAt" name="targetAt" type="date" className="input" />
          </div>
          <div className="sm:col-span-3">
            <label className="label" htmlFor="description">
              {dict.description}
            </label>
            <textarea id="description" name="description" rows={2} className="input" />
          </div>
          <div className="sm:col-span-3">
            <button type="submit" className="btn-primary">
              {dict.create}
            </button>
          </div>
        </form>
      </section>

      {goalRows.length === 0 ? (
        <p className="card py-8 text-center text-sm text-muted">{dict.noGoals}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {goalRows.map((goal) => {
            const progress = computeGoalProgress(goal.id, taskRows);
            return (
              <li key={goal.id} className="card flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold">{goal.title}</h2>
                    {goal.targetAt && (
                      <p className="text-[11px] text-muted">{formatDate(goal.targetAt, locale)}</p>
                    )}
                  </div>
                  <form action={deleteGoalAction}>
                    <input type="hidden" name="id" value={goal.id} />
                    <button type="submit" className="text-xs text-muted hover:text-red-600" aria-label={dict.delete}>
                      ✕
                    </button>
                  </form>
                </div>
                {goal.description && <p className="text-xs text-muted">{goal.description}</p>}
                <ProgressBar percent={progress.percent} label={dict.progress} />
                <p className="text-[11px] text-muted">
                  {progress.done}/{progress.total} {dict.tasks}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
