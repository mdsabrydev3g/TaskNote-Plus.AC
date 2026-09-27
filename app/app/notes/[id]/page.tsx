import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { notes, projects } from '@/db/schema';
import { requireSession } from '@/lib/auth/current';
import { getTranslator } from '@/lib/i18n';
import { dictionaries } from '@/lib/i18n/dictionaries';
import { deleteNoteAction, saveNoteAction } from '@/app/actions/notes';
import { AiDraftPanel } from '@/components/ai-draft-panel';
import { formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function NoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const { locale } = await getTranslator();
  const dict = dictionaries[locale];

  const rows = await db()
    .select()
    .from(notes)
    .where(and(eq(notes.workspaceId, session.workspaceId), eq(notes.id, id)))
    .limit(1);
  const note = rows[0];
  if (!note) notFound();

  const projectRows = await db()
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.workspaceId, session.workspaceId));

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{note.title || dict.newNote}</h1>
        <span className="text-[11px] text-muted">{formatDateTime(note.updatedAt, locale)}</span>
      </header>

      <form action={saveNoteAction} className="card flex flex-col gap-3">
        <input type="hidden" name="id" value={note.id} />
        <div>
          <label className="label" htmlFor="title">
            {dict.title}
          </label>
          <input id="title" name="title" className="input" defaultValue={note.title} maxLength={300} />
        </div>
        <div>
          <label className="label" htmlFor="body">
            {dict.body}
          </label>
          <textarea id="body" name="body" rows={12} className="input font-mono text-xs" defaultValue={note.body} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="projectId">
              {dict.project}
            </label>
            <select id="projectId" name="projectId" className="input" defaultValue={note.projectId ?? ''}>
              <option value="">{dict.none}</option>
              {projectRows.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col justify-end gap-2 text-xs">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="pinned" defaultChecked={note.pinned} />
              {dict.title}
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="aiAccessible" defaultChecked={note.aiAccessible} />
              {dict.permissions}
            </label>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn-primary">
            {dict.save}
          </button>
        </div>
      </form>

      <AiDraftPanel noteId={note.id} dict={dict} aiEnabled={note.aiAccessible} />

      <form action={deleteNoteAction}>
        <input type="hidden" name="id" value={note.id} />
        <button type="submit" className="btn-danger px-3 py-1.5 text-xs">
          {dict.delete}
        </button>
      </form>
    </div>
  );
}
