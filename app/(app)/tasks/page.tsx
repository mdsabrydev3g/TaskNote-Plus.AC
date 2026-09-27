import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { projects, tasks } from '@/db/schema';
import { requireSession } from '@/lib/auth/current';
import { getTranslator } from '@/lib/i18n';
import { dictionaries } from '@/lib/i18n/dictionaries';
import { TaskItem } from '@/components/task-item';
import { createTaskAction, quickAddTaskAction } from '@/app/actions/tasks';
import { isActionable } from '@/lib/progress';

export const dynamic = 'force-dynamic';

const COLUMNS = ['todo', 'doing', 'done'] as const;

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; filter?: string }>;
}) {
  const params = await searchParams;
  const session = await requireSession();
  const { locale } = await getTranslator();
  const dict = dictionaries[locale];

  const view = params.view === 'board' ? 'board' : 'list';
  const filter = params.filter ?? 'all';

  const rows = await db()
    .select()
    .from(tasks)
    .where(eq(tasks.workspaceId, session.workspaceId))
    .orderBy(desc(tasks.createdAt));

  const projectRows = await db()
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.workspaceId, session.workspaceId));
  const projectName = new Map(projectRows.map((p) => [p.id, p.name]));

  const now = new Date();
  const visible = rows.filter((task) => {
    if (filter === 'today') return isActionable(task, now) && Boolean(task.dueAt) && new Date(task.dueAt!) <= endOfDay(now);
    if (filter === 'open') return task.status !== 'done';
    return true;
  });

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{dict.tasks}</h1>
        <div className="flex gap-2">
          <Link href="/app/tasks?view=list" className={`chip ${view === 'list' ? 'chip-active' : ''}`}>
            {dict.list}
          </Link>
          <Link href="/app/tasks?view=board" className={`chip ${view === 'board' ? 'chip-active' : ''}`}>
            {dict.board}
          </Link>
        </div>
      </header>

      <section className="card">
        <form action={quickAddTaskAction} className="flex gap-2">
          <input
            name="quick"
            className="input"
            placeholder={dict.capturePlaceholder}
            aria-label={dict.capture}
            required
          />
          <button type="submit" className="btn-primary shrink-0">
            {dict.create}
          </button>
        </form>
      </section>

      <section className="card">
        <h2 className="mb-3 text-sm font-semibold">{dict.newTask}</h2>
        <form action={createTaskAction} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="title">
              {dict.title}
            </label>
            <input id="title" name="title" className="input" required maxLength={500} />
          </div>
          <div>
            <label className="label" htmlFor="energy">
              {dict.energy}
            </label>
            <select id="energy" name="energy" className="input" defaultValue="admin">
              <option value="deep">{dict.energyDeep}</option>
              <option value="light">{dict.energyLight}</option>
              <option value="admin">{dict.energyAdmin}</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="priority">
              {dict.priority}
            </label>
            <select id="priority" name="priority" className="input" defaultValue="1">
              <option value="0">P3</option>
              <option value="1">P2</option>
              <option value="2">P1</option>
              <option value="3">P0</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="dueAt">
              {dict.dueDate}
            </label>
            <input id="dueAt" name="dueAt" type="datetime-local" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="projectId">
              {dict.project}
            </label>
            <select id="projectId" name="projectId" className="input" defaultValue="">
              <option value="">{dict.none}</option>
              {projectRows.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary">
              {dict.create}
            </button>
          </div>
        </form>
      </section>

      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: dict.allTypes },
          { key: 'open', label: dict.statusTodo },
          { key: 'today', label: dict.today },
        ].map((option) => (
          <Link
            key={option.key}
            href={`/app/tasks?view=${view}&filter=${option.key}`}
            className={`chip ${filter === option.key ? 'chip-active' : ''}`}
          >
            {option.label}
          </Link>
        ))}
      </div>

      {view === 'list' ? (
        <section className="card">
          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">{dict.noTasks}</p>
          ) : (
            <ul>
              {visible.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  dict={dict}
                  locale={locale}
                  projectName={task.projectId ? projectName.get(task.projectId) : undefined}
                />
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="grid gap-3 md:grid-cols-3">
          {COLUMNS.map((column) => (
            <div key={column} className="card">
              <h2 className="mb-2 text-sm font-semibold">
                {dict[`status${column === 'todo' ? 'Todo' : column === 'doing' ? 'Doing' : 'Done'}` as keyof typeof dict]}
              </h2>
              <ul className="flex flex-col gap-2">
                {visible
                  .filter((task) => task.status === column)
                  .map((task) => (
                    <li key={task.id} className="rounded-xl border border-line bg-surface p-3">
                      <TaskItem
                        task={task}
                        dict={dict}
                        locale={locale}
                        projectName={task.projectId ? projectName.get(task.projectId) : undefined}
                      />
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function endOfDay(now: Date): Date {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return end;
}
