'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { tasks } from '@/db/schema';
import { assertSameOrigin, requireSessionOrThrow } from '@/lib/auth/current';
import { writeAudit } from '@/lib/db/scope';
import { taskCreateSchema } from '@/lib/validation';
import { parseQuickAdd } from '@/lib/nl-quickadd';

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function createTaskAction(formData: FormData): Promise<void> {
  const session = await requireSessionOrThrow();
  await assertSameOrigin();

  const parsed = taskCreateSchema.safeParse({
    title: String(formData.get('title') ?? ''),
    description: String(formData.get('description') ?? ''),
    projectId: String(formData.get('projectId') ?? '') || null,
    goalId: String(formData.get('goalId') ?? '') || null,
    status: String(formData.get('status') ?? 'todo'),
    priority: String(formData.get('priority') ?? '1'),
    energy: String(formData.get('energy') ?? 'admin'),
    dueAt: String(formData.get('dueAt') ?? '') || null,
    deferAt: String(formData.get('deferAt') ?? '') || null,
  });
  if (!parsed.success) return;

  const [task] = await db()
    .insert(tasks)
    .values({
      workspaceId: session.workspaceId,
      title: parsed.data.title,
      description: parsed.data.description,
      projectId: parsed.data.projectId ?? null,
      goalId: parsed.data.goalId ?? null,
      status: parsed.data.status,
      priority: parsed.data.priority,
      energy: parsed.data.energy,
      dueAt: toDate(parsed.data.dueAt),
      deferAt: toDate(parsed.data.deferAt),
    })
    .returning();

  await writeAudit({
    workspaceId: session.workspaceId,
    actorUserId: session.userId,
    action: 'task.create',
    entityType: 'task',
    entityId: task.id,
  });

  revalidatePath('/app/tasks');
  revalidatePath('/app/home');
}

/** Natural-language quick add. Parsing is local and deterministic. */
export async function quickAddTaskAction(formData: FormData): Promise<void> {
  const session = await requireSessionOrThrow();
  await assertSameOrigin();

  const raw = String(formData.get('quick') ?? '').trim();
  if (!raw) return;

  const parsed = parseQuickAdd(raw, new Date());
  const [task] = await db()
    .insert(tasks)
    .values({
      workspaceId: session.workspaceId,
      title: parsed.title || raw.slice(0, 200),
      priority: parsed.priority,
      energy: parsed.energy,
      dueAt: parsed.dueAt ? new Date(parsed.dueAt) : null,
    })
    .returning();

  await writeAudit({
    workspaceId: session.workspaceId,
    actorUserId: session.userId,
    action: 'task.quick_add',
    entityType: 'task',
    entityId: task.id,
  });

  revalidatePath('/app/tasks');
  revalidatePath('/app/home');
}

export async function setTaskStatusAction(formData: FormData): Promise<void> {
  const session = await requireSessionOrThrow();
  await assertSameOrigin();

  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!id || !['todo', 'doing', 'done'].includes(status)) return;

  const next = status as 'todo' | 'doing' | 'done';
  await db()
    .update(tasks)
    .set({
      status: next,
      completedAt: next === 'done' ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(and(eq(tasks.workspaceId, session.workspaceId), eq(tasks.id, id)));

  await writeAudit({
    workspaceId: session.workspaceId,
    actorUserId: session.userId,
    action: `task.status.${next}`,
    entityType: 'task',
    entityId: id,
  });

  revalidatePath('/app/tasks');
  revalidatePath('/app/home');
  revalidatePath('/app/projects');
  revalidatePath('/app/goals');
}

export async function deleteTaskAction(formData: FormData): Promise<void> {
  const session = await requireSessionOrThrow();
  await assertSameOrigin();
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  await db()
    .delete(tasks)
    .where(and(eq(tasks.workspaceId, session.workspaceId), eq(tasks.id, id)));

  await writeAudit({
    workspaceId: session.workspaceId,
    actorUserId: session.userId,
    action: 'task.delete',
    entityType: 'task',
    entityId: id,
  });

  revalidatePath('/app/tasks');
  revalidatePath('/app/home');
}
