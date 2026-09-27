import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { projects, tasks } from '@/db/schema';
import { requireSession } from '@/lib/auth/current';
import { getTranslator } from '@/lib/i18n';
import { dictionaries } from '@/lib/i18n/dictionaries';
import { saveProjectAction } from '@/app/actions/projects';
import { computeProjectProgress } from '@/lib/progress';
import { ProgressBar } from '@/components/progress-bar';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const session = await requireSession();
  const { locale } = await getTranslator();
  const dict = dictionaries[locale];

  const projectRows = await db()
    .select()
    .from(projects)
    .where(eq(projects.workspaceId, session.workspaceId))
    .orderBy(desc(projects.createdAt));

  const taskRows = await db()
    .select({ id: tasks.id, status: tasks.status, projectId: tasks.projectId })
    .from(tasks)
    .where(eq(tasks.workspaceId, session.workspaceId));

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold">{dict.projects}</h1>
        <p className="text-xs text-muted">{dict.progress}: {dict.tasks}</p>
      </header>

      <section className="card">
        <h2 className="mb-3 text-sm font-semibold">{dict.newProject}</h2>
        <form action={saveProjectAction} className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">
              {dict.title}
            </label>
            <input id="name" name="name" className="input" required maxLength={200} />
          </div>
          <div>
            <label className="label" htmlFor="color">
              {dict.theme}
            </label>
            <input id="color" name="color" type="color" defaultValue="#3c60ee" className="input h-10 p-1" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="description">
              {dict.description}
            </label>
            <textarea id="description" name="description" rows={2} className="input" />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary">
              {dict.create}
            </button>
          </div>
        </form>
      </section>

      {projectRows.length === 0 ? (
        <p className="card py-8 text-center text-sm text-muted">{dict.noProjects}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {projectRows.map((project) => {
            const progress = computeProjectProgress(project.id, taskRows);
            return (
              <li key={project.id} className="card">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Link
                    href={`/app/projects/${project.id}`}
                    className="truncate text-sm font-semibold hover:underline"
                  >
                    <span aria-hidden="true" className="me-2 inline-block h-2 w-2 rounded-full" style={{ background: project.color }} />
                    {project.name}
                  </Link>
                  <span className="chip">{project.status}</span>
                </div>
                {project.description && (
                  <p className="mb-3 line-clamp-2 text-xs text-muted">{project.description}</p>
                )}
                <ProgressBar percent={progress.percent} label={dict.progress} />
                <p className="mt-2 text-[11px] text-muted">
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
