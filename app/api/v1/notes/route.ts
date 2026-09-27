import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { notes } from '@/db/schema';
import { sessionFromApiRequest } from '@/lib/api/auth';
import { guard, jsonError, jsonOk, readJson, requestIp } from '@/lib/api/http';
import { toNoteDto } from '@/lib/api/dto';
import { writeAudit } from '@/lib/db/scope';
import { rateLimit } from '@/lib/rate-limit';
import { noteSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/notes */
export async function GET(request: Request) {
  return guard(async () => {
    const session = await sessionFromApiRequest(request);
    if (!session) return jsonError('unauthenticated', 401, 'missing_or_invalid_token');

    const rows = await db()
      .select()
      .from(notes)
      .where(eq(notes.workspaceId, session.workspaceId))
      .orderBy(desc(notes.pinned), desc(notes.updatedAt))
      .limit(200);

    return jsonOk({ items: rows.map(toNoteDto), count: rows.length });
  });
}

/** POST /api/v1/notes */
export async function POST(request: Request) {
  return guard(async () => {
    const session = await sessionFromApiRequest(request);
    if (!session) return jsonError('unauthenticated', 401, 'missing_or_invalid_token');

    if (!rateLimit(`api-notes:${session.workspaceId}`, 120, 60_000).allowed) {
      return jsonError('rate_limited', 429, 'too_many_writes');
    }

    const body = await readJson(request);
    if (!body) return jsonError('invalid_request', 400, 'a JSON object body is required');

    const parsed = noteSchema.safeParse({
      title: body.title ?? '',
      body: body.body ?? '',
      projectId: body.projectId ?? null,
      pinned: body.pinned ?? false,
      aiAccessible: body.aiAccessible ?? false,
    });
    if (!parsed.success) return jsonError('invalid_request', 400, 'invalid_fields');

    const [note] = await db()
      .insert(notes)
      .values({
        workspaceId: session.workspaceId,
        title: parsed.data.title,
        body: parsed.data.body,
        projectId: parsed.data.projectId ?? null,
        pinned: parsed.data.pinned,
        aiAccessible: parsed.data.aiAccessible,
      })
      .returning();

    await writeAudit({
      workspaceId: session.workspaceId,
      actorUserId: session.userId,
      action: 'note.create',
      entityType: 'note',
      entityId: note.id,
      ip: requestIp(request),
    });

    return jsonOk({ note: toNoteDto(note) }, 201);
  });
}
