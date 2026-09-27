import { notFound } from 'next/navigation';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { milestones, projects, tasks } from '@/db/schema';
import { requireSession } from '@/lib/auth/current';
import { getTranslator } from '@/lib/i18n';
import { dictionaries } from '@/lib/i18n/dictionaries';
import { TaskItem } from '@/components/task-item';
import { ProgressBar } from '@/components/progress-bar';
import { computeProjectProgress } from '@/lib/progress';
import {
  addMilestoneAction,
  deleteProjectAction,
  toggleMilestoneAction,
} from '@/app/actions/projects';
import { formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const { locale } = await getTranslator();
  const dict = dictionaries[locale];

  const rows = await db()
    .select()
    .from(projects)
    .where(and(eq(projects.workspaceId, session.workspaceId), eq(projects.id, id)))
    .limit(1);
  const project = rows[0];
  if (!project) notFound();

  const projectTasks = await db()
    .select()
    .from(tasks)
    .where(and(eq(tasks.workspaceId, session.workspaceId), eq(tasks.projectId, id)))
    .orderBy(asc(tasks.status));

  const projectMilestones = await db()
    .select()
    .from(milestones)
    .where(and(eq(milestones.workspaceId, session.workspaceId), eq(milestones.projectId, id)))
    .orderBy(asc(milestones.createdAt));

  const progress = computeProjectProgress(id, projectTasks);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{project.name}</h1>
          {project.description && <p className="mt-1 text-xs text-muted">{project.description}</p>}
        </div>
        <form action={deleteProjectAction}>
          <input type="hidden" name="id" value={project.id} />
          <button type="submit" className="btn-danger px-3 py-1.5 text-xs">
            {dict.delete}
          </button>
        </form>
      </header>

      <section className="card">
        <ProgressBar percent={progress.percent} label={dict.progress} />
        <p className="mt-2 text-[11px] text-muted">
          {progress.done}/{progress.total} {dict.tasks}
        </p>
      </section>

      <section className="card">
        <h2 className="mb-3 text-sm font-semibold">{dict.milestones}</h2>
        {projectMilestones.length === 0 ? (
          <p className="text-xs text-muted">—</p>
        ) : (
          <ul className="mb-3 flex flex-col gap-2">
            {projectMilestones.map((milestone) => (
              <li key={milestone.id} className="flex items-center justify-between gap-3 text-sm">
                <form action={toggleMilestoneAction} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={milestone.id} />
                  <input type="hidden" name="projectId" value={project.id} />
                  <input type="hidden" name="done" value={String(milestone.done)} />
                  <button
                    type="submit"
                    className={`grid h-4 w-4 place-items-center rounded border text-[10px] ${
                      milestone.done ? 'border-brand-600 bg-brand-600 text-white' : 'border-line text-transparent'
                    }`}
                    aria-label={milestone.title}
                  >
                    ✓
                  </button>
                  <span className={milestone.done ? 'text-muted line-through' : ''}>{milestone.title}</span>
                </form>
                {milestone.dueAt && (
                  <span className="text-[11px] text-muted">{formatDate(milestone.dueAt, locale)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        <form action={addMilestoneAction} className="flex flex-wrap gap-2">
          <input type="hidden" name="projectId" value={project.id} />
          <input name="title" className="input flex-1" placeholder={dict.milestones} required />
          <input name="dueAt" type="date" className="input w-auto" />
          <button type="submit" className="btn-ghost">{dict.create}</button>
        </form>
      </section>

      <section className="card">
        <h2 className="mb-2 text-sm font-semibold">{dict.tasks}</h2>
        {projectTasks.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">{dict.noTasks}</p>
        ) : (
          <ul>
            {projectTasks.map((task) => (
              <TaskItem key={task.id} task={task} dict={dict} locale={locale} projectName={project.name} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
