import { and, desc, eq, gte, lte, ne, or, isNull, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { inboxItems, notes, projects, tasks } from '@/db/schema';
import { requireSession } from '@/lib/auth/current';
import { getTranslator } from '@/lib/i18n';
import { dictionaries } from '@/lib/i18n/dictionaries';
import { CaptureForm } from '@/components/capture-form';
import { TaskItem } from '@/components/task-item';
import { isActionable } from '@/lib/progress';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const session = await requireSession();
  const { locale } = await getTranslator();
  const dict = dictionaries[locale];

  const allTasks = await db()
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
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const todayTasks = allTasks.filter(
    (task) =>
      isActionable(task, now) &&
      (task.dueAt ? new Date(task.dueAt) <= endOfDay : false),
  );

  const focusTasks =
    todayTasks.length > 0
      ? todayTasks
      : allTasks.filter((t) => isActionable(t, now)).slice(0, 5);

  const inboxCount = await db()
    .select({ count: sql<number>`count(*)::int` })
    .from(inboxItems)
    .where(and(eq(inboxItems.workspaceId, session.workspaceId), eq(inboxItems.status, 'new')));

  const openTaskCount = allTasks.filter((t) => t.status !== 'done').length;
  const noteCount = await db()
    .select({ count: sql<number>`count(*)::int` })
    .from(notes)
    .where(eq(notes.workspaceId, session.workspaceId));

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold">{dict.home}</h1>
        <p className="text-xs text-muted">{dict.tagline}</p>
      </header>

      <CaptureForm dict={dict} />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label={dict.inbox} value={inboxCount[0]?.count ?? 0} href="/app/inbox" />
        <Stat label={dict.tasks} value={openTaskCount} href="/app/tasks" />
        <Stat label={dict.notes} value={noteCount[0]?.count ?? 0} href="/app/notes" />
      </section>

      <section className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{dict.today}</h2>
          <Link href="/app/tasks" className="text-xs text-brand-600 hover:underline">
            {dict.tasks}
          </Link>
        </div>
        {focusTasks.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">{dict.noTasks}</p>
        ) : (
          <ul>
            {focusTasks.map((task) => (
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
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="card flex flex-col gap-1 hover:border-brand-400">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-2xl font-semibold">{value}</span>
    </Link>
  );
}
