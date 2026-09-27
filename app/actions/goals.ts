'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { goals } from '@/db/schema';
import { assertSameOrigin, requireSessionOrThrow } from '@/lib/auth/current';
import { writeAudit } from '@/lib/db/scope';
import { goalSchema } from '@/lib/validation';

export async function saveGoalAction(formData: FormData): Promise<void> {
  const session = await requireSessionOrThrow();
  await assertSameOrigin();

  const parsed = goalSchema.safeParse({
    id: String(formData.get('id') ?? '') || undefined,
    title: String(formData.get('title') ?? ''),
    description: String(formData.get('description') ?? ''),
    status: String(formData.get('status') ?? 'active'),
    targetAt: String(formData.get('targetAt') ?? '') || null,
  });
  if (!parsed.success) return;

  const target = parsed.data.targetAt ? new Date(parsed.data.targetAt) : null;
  const targetAt = target && !Number.isNaN(target.getTime()) ? target : null;

  if (parsed.data.id) {
    await db()
      .update(goals)
      .set({
        title: parsed.data.title,
        description: parsed.data.description,
        status: parsed.data.status,
        targetAt,
        updatedAt: new Date(),
      })
      .where(and(eq(goals.workspaceId, session.workspaceId), eq(goals.id, parsed.data.id)));
    await writeAudit({
      workspaceId: session.workspaceId,
      actorUserId: session.userId,
      action: 'goal.update',
      entityType: 'goal',
      entityId: parsed.data.id,
    });
  } else {
    const [goal] = await db()
      .insert(goals)
      .values({
        workspaceId: session.workspaceId,
        title: parsed.data.title,
        description: parsed.data.description,
        status: parsed.data.status,
        targetAt,
      })
      .returning();
    await writeAudit({
      workspaceId: session.workspaceId,
      actorUserId: session.userId,
      action: 'goal.create',
      entityType: 'goal',
      entityId: goal.id,
    });
  }

  revalidatePath('/app/goals');
}

export async function deleteGoalAction(formData: FormData): Promise<void> {
  const session = await requireSessionOrThrow();
  await assertSameOrigin();
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  await db()
    .delete(goals)
    .where(and(eq(goals.workspaceId, session.workspaceId), eq(goals.id, id)));

  await writeAudit({
    workspaceId: session.workspaceId,
    actorUserId: session.userId,
    action: 'goal.delete',
    entityType: 'goal',
    entityId: id,
  });

  revalidatePath('/app/goals');
}
