import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { notes, projects } from '@/db/schema';
import { requireSession } from '@/lib/auth/current';
import { getTranslator } from '@/lib/i18n';
import { dictionaries } from '@/lib/i18n/dictionaries';
import { saveNoteAction } from '@/app/actions/notes';
import { formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function NotesPage() {
  const session = await requireSession();
  const { locale } = await getTranslator();
  const dict = dictionaries[locale];

  const noteRows = await db()
    .select()
    .from(notes)
    .where(eq(notes.workspaceId, session.workspaceId))
    .orderBy(desc(notes.pinned), desc(notes.updatedAt));

  const projectRows = await db()
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.workspaceId, session.workspaceId));
  const projectName = new Map(projectRows.map((p) => [p.id, p.name]));

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold">{dict.notes}</h1>
      </header>

      <section className="card">
        <h2 className="mb-3 text-sm font-semibold">{dict.newNote}</h2>
        <form action={saveNoteAction} className="flex flex-col gap-3">
          <input name="title" className="input" placeholder={dict.title} maxLength={300} />
          <textarea name="body" rows={3} className="input" placeholder={dict.body} />
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
          <div>
            <button type="submit" className="btn-primary">
              {dict.create}
            </button>
          </div>
        </form>
      </section>

      {noteRows.length === 0 ? (
        <p className="card py-8 text-center text-sm text-muted">{dict.noNotes}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {noteRows.map((note) => (
            <li key={note.id} className="card">
              <Link href={`/app/notes/${note.id}`} className="block">
                <h2 className="truncate text-sm font-semibold">
                  {note.pinned && <span aria-hidden="true">📌 </span>}
                  {note.title || dict.newNote}
                </h2>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-muted">
                  {note.body.slice(0, 240)}
                </p>
                <p className="mt-2 text-[11px] text-muted">
                  {formatDateTime(note.updatedAt, locale)}
                  {note.projectId && projectName.get(note.projectId)
                    ? ` · ${projectName.get(note.projectId)}`
                    : ''}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
