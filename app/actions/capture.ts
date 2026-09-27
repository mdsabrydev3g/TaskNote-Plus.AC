'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { inboxItems, notes, tasks } from '@/db/schema';
import { assertSameOrigin, requestIp, requireSessionOrThrow } from '@/lib/auth/current';
import { contentKey } from '@/lib/hash';
import { writeAudit } from '@/lib/db/scope';
import { captureSchema } from '@/lib/validation';
import { parseQuickAdd } from '@/lib/nl-quickadd';

export type CaptureState = {
  ok?: boolean;
  status?: 'created' | 'duplicate' | 'error';
  message?: string;
};

export async function captureAction(_prev: CaptureState, formData: FormData): Promise<CaptureState> {
  const session = await requireSessionOrThrow();
  await assertSameOrigin();

  const parsed = captureSchema.safeParse({
    rawText: String(formData.get('rawText') ?? ''),
    source: String(formData.get('source') ?? 'text'),
  });
  if (!parsed.success) return { status: 'error', message: 'requiredFields' };

  const hash = contentKey(parsed.data.rawText);

  // Idempotency: the unique index on (workspace_id, content_hash) makes
  // re-submitting identical content a no-op instead of a duplicate row.
  const inserted = await db()
    .insert(inboxItems)
    .values({
      workspaceId: session.workspaceId,
      rawText: parsed.data.rawText,
      contentHash: hash,
      source: parsed.data.source,
    })
    .onConflictDoNothing({ target: [inboxItems.workspaceId, inboxItems.contentHash] })
    .returning();

  revalidatePath('/app/inbox');
  revalidatePath('/app/home');

  if (inserted.length === 0) return { ok: true, status: 'duplicate', message: 'duplicateCapture' };

  await writeAudit({
    workspaceId: session.workspaceId,
    actorUserId: session.userId,
    action: 'inbox.capture',
    entityType: 'inbox_item',
    entityId: inserted[0].id,
    ip: await requestIp(),
  });

  return { ok: true, status: 'created', message: 'captured' };
}

export async function discardInboxAction(formData: FormData): Promise<void> {
  const session = await requireSessionOrThrow();
  await assertSameOrigin();
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  await db()
    .update(inboxItems)
    .set({ status: 'discarded', updatedAt: new Date(), version: 1 })
    .where(and(eq(inboxItems.workspaceId, session.workspaceId), eq(inboxItems.id, id)));

  revalidatePath('/app/inbox');
}

export async function convertInboxToTaskAction(formData: FormData): Promise<void> {
  const session = await requireSessionOrThrow();
  await assertSameOrigin();
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const rows = await db()
    .select()
    .from(inboxItems)
    .where(and(eq(inboxItems.workspaceId, session.workspaceId), eq(inboxItems.id, id)))
    .limit(1);
  const item = rows[0];
  if (!item) return;

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

  revalidatePath('/app/inbox');
  revalidatePath('/app/tasks');
  revalidatePath('/app/home');
}

export async function convertInboxToNoteAction(formData: FormData): Promise<void> {
  const session = await requireSessionOrThrow();
  await assertSameOrigin();
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const rows = await db()
    .select()
    .from(inboxItems)
    .where(and(eq(inboxItems.workspaceId, session.workspaceId), eq(inboxItems.id, id)))
    .limit(1);
  const item = rows[0];
  if (!item) return;

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

  revalidatePath('/app/inbox');
  revalidatePath('/app/notes');
}
