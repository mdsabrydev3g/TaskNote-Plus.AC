import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { notes } from '@/db/schema';
import { sessionFromApiRequest } from '@/lib/api/auth';
import { guard, jsonError, jsonOk, readJson } from '@/lib/api/http';
import { toNoteDto } from '@/lib/api/dto';
import { writeAudit } from '@/lib/db/scope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

async function load(workspaceId: string, id: string) {
  const rows = await db()
    .select()
    .from(notes)
    .where(and(eq(notes.workspaceId, workspaceId), eq(notes.id, id)))
    .limit(1);
  return rows[0];
}

/** GET /api/v1/notes/:id */
export async function GET(request: Request, { params }: Params) {
  return guard(async () => {
    const session = await sessionFromApiRequest(request);
    if (!session) return jsonError('unauthenticated', 401, 'missing_or_invalid_token');
    const { id } = await params;

    const note = await load(session.workspaceId, id);
    if (!note) return jsonError('not_found', 404, 'note_not_found');
    return jsonOk({ note: toNoteDto(note) });
  });
}

/** PATCH /api/v1/notes/:id */
export async function PATCH(request: Request, { params }: Params) {
  return guard(async () => {
    const session = await sessionFromApiRequest(request);
    if (!session) return jsonError('unauthenticated', 401, 'missing_or_invalid_token');
    const { id } = await params;

    const body = await readJson(request);
    if (!body) return jsonError('invalid_request', 400, 'a JSON object body is required');

    const existing = await load(session.workspaceId, id);
    if (!existing) return jsonError('not_found', 404, 'note_not_found');

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.title === 'string') patch.title = body.title.slice(0, 300);
    if (typeof body.body === 'string') patch.body = body.body.slice(0, 200000);
    if (typeof body.pinned === 'boolean') patch.pinned = body.pinned;
    if (typeof body.aiAccessible === 'boolean') patch.aiAccessible = body.aiAccessible;
    if ('projectId' in body) {
      const raw = body.projectId;
      if (raw === null || raw === '') patch.projectId = null;
      else if (typeof raw === 'string') patch.projectId = raw;
      else return jsonError('invalid_request', 400, 'invalid_projectId');
    }

    const [updated] = await db()
      .update(notes)
      .set(patch)
      .where(and(eq(notes.workspaceId, session.workspaceId), eq(notes.id, id)))
      .returning();

    await writeAudit({
      workspaceId: session.workspaceId,
      actorUserId: session.userId,
      action: 'note.update',
      entityType: 'note',
      entityId: id,
    });

    return jsonOk({ note: toNoteDto(updated) });
  });
}

/** DELETE /api/v1/notes/:id */
export async function DELETE(request: Request, { params }: Params) {
  return guard(async () => {
    const session = await sessionFromApiRequest(request);
    if (!session) return jsonError('unauthenticated', 401, 'missing_or_invalid_token');
    const { id } = await params;

    const existing = await load(session.workspaceId, id);
    if (!existing) return jsonError('not_found', 404, 'note_not_found');

    await db()
      .delete(notes)
      .where(and(eq(notes.workspaceId, session.workspaceId), eq(notes.id, id)));

    await writeAudit({
      workspaceId: session.workspaceId,
      actorUserId: session.userId,
      action: 'note.delete',
      entityType: 'note',
      entityId: id,
    });

    return jsonOk({ deleted: true, id });
  });
}
