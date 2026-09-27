'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { notes } from '@/db/schema';
import { assertSameOrigin, requireSessionOrThrow } from '@/lib/auth/current';
import { writeAudit } from '@/lib/db/scope';
import { noteSchema } from '@/lib/validation';

export async function saveNoteAction(formData: FormData): Promise<void> {
  const session = await requireSessionOrThrow();
  await assertSameOrigin();

  const parsed = noteSchema.safeParse({
    id: String(formData.get('id') ?? '') || undefined,
    title: String(formData.get('title') ?? ''),
    body: String(formData.get('body') ?? ''),
    projectId: String(formData.get('projectId') ?? '') || null,
    pinned: formData.get('pinned') === 'on',
    aiAccessible: formData.get('aiAccessible') === 'on',
  });
  if (!parsed.success) return;

  if (parsed.data.id) {
    await db()
      .update(notes)
      .set({
        title: parsed.data.title,
        body: parsed.data.body,
        projectId: parsed.data.projectId ?? null,
        pinned: parsed.data.pinned,
        aiAccessible: parsed.data.aiAccessible,
        updatedAt: new Date(),
      })
      .where(and(eq(notes.workspaceId, session.workspaceId), eq(notes.id, parsed.data.id)));

    await writeAudit({
      workspaceId: session.workspaceId,
      actorUserId: session.userId,
      action: 'note.update',
      entityType: 'note',
      entityId: parsed.data.id,
    });

    revalidatePath(`/app/notes/${parsed.data.id}`);
  } else {
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
    });
  }

  revalidatePath('/app/notes');
  revalidatePath('/app/home');
}

export async function deleteNoteAction(formData: FormData): Promise<void> {
  const session = await requireSessionOrThrow();
  await assertSameOrigin();
  const id = String(formData.get('id') ?? '');
  if (!id) return;

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

  revalidatePath('/app/notes');
}
