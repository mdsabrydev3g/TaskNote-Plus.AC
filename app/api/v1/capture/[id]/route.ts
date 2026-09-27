import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { inboxItems, notes, tasks } from '@/db/schema';
import { sessionFromApiRequest } from '@/lib/api/auth';
import { guard, jsonError, jsonOk, readJson } from '@/lib/api/http';
import { toInboxDto, toNoteDto, toTaskDto } from '@/lib/api/dto';
import { writeAudit } from '@/lib/db/scope';
import { parseQuickAdd } from '@/lib/nl-quickadd';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

async function loadItem(workspaceId: string, id: string) {
  const rows = await db()
    .select()
    .from(inboxItems)
    .where(and(eq(inboxItems.workspaceId, workspaceId), eq(inboxItems.id, id)))
    .limit(1);
  return rows[0];
}

/**
 * POST /api/v1/capture/:id
 * body: { action: "convert-to-task" | "convert-to-note" | "discard" }
 */
export async function POST(request: Request, { params }: Params) {
  return guard(async () => {
    const session = await sessionFromApiRequest(request);
    if (!session) return jsonError('unauthenticated', 401, 'missing_or_invalid_token');

    const { id } = await params;
    const body = await readJson(request);
    const action = typeof body?.action === 'string' ? body.action : '';
    if (!['convert-to-task', 'convert-to-note', 'discard'].includes(action)) {
      return jsonError('invalid_request', 400, 'unknown_action');
    }

    const item = await loadItem(session.workspaceId, id);
    if (!item) return jsonError('not_found', 404, 'inbox_item_not_found');
    if (item.status !== 'new') return jsonError('conflict', 409, 'already_processed');

    if (action === 'discard') {
      await db()
        .update(inboxItems)
        .set({ status: 'discarded', updatedAt: new Date() })
        .where(and(eq(inboxItems.workspaceId, session.workspaceId), eq(inboxItems.id, id)));
      return jsonOk({ status: 'discarded', item: toInboxDto({ ...item, status: 'discarded' }) });
    }

    if (action === 'convert-to-task') {
      const parsed = parseQuickAdd(item.rawText, new Date());
      const [task] = await db()
        .insert(tasks)
        .values({
          workspaceId: session.workspaceId,
          title: parsed.title || item.rawText.slice(0, 200),
          priority: parsed.priority,
          energy: parsed.energy,
          dueAt: parsed.dueAt ? new Date(parsed.dueAt) : null,
        })
        .returning();

      await db()
        .update(inboxItems)
        .set({
          status: 'processed',
          processedEntityType: 'task',
          processedEntityId: task.id,
          updatedAt: new Date(),
        })
        .where(and(eq(inboxItems.workspaceId, session.workspaceId), eq(inboxItems.id, id)));

      await writeAudit({
        workspaceId: session.workspaceId,
        actorUserId: session.userId,
        action: 'inbox.to_task',
        entityType: 'task',
        entityId: task.id,
      });

      return jsonOk({ status: 'processed', entityType: 'task', task: toTaskDto(task) }, 201);
    }

    const firstLine = item.rawText.split('\n')[0] ?? '';
    const [note] = await db()
      .insert(notes)
      .values({
        workspaceId: session.workspaceId,
        title: firstLine.slice(0, 120),
        body: item.rawText,
      })
      .returning();

    await db()
      .update(inboxItems)
      .set({
        status: 'processed',
        processedEntityType: 'note',
        processedEntityId: note.id,
        updatedAt: new Date(),
      })
      .where(and(eq(inboxItems.workspaceId, session.workspaceId), eq(inboxItems.id, id)));

    await writeAudit({
      workspaceId: session.workspaceId,
      actorUserId: session.userId,
      action: 'inbox.to_note',
      entityType: 'note',
      entityId: note.id,
    });

    return jsonOk({ status: 'processed', entityType: 'note', note: toNoteDto(note) }, 201);
  });
}

/** DELETE /api/v1/capture/:id - soft discard, same effect as the discard action. */
export async function DELETE(request: Request, { params }: Params) {
  return guard(async () => {
    const session = await sessionFromApiRequest(request);
    if (!session) return jsonError('unauthenticated', 401, 'missing_or_invalid_token');

    const { id } = await params;
    const item = await loadItem(session.workspaceId, id);
    if (!item) return jsonError('not_found', 404, 'inbox_item_not_found');

    await db()
      .update(inboxItems)
      .set({ status: 'discarded', updatedAt: new Date() })
      .where(and(eq(inboxItems.workspaceId, session.workspaceId), eq(inboxItems.id, id)));

    return jsonOk({ status: 'discarded', id });
  });
}
