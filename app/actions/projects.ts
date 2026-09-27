'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { milestones, projects } from '@/db/schema';
import { assertSameOrigin, requireSessionOrThrow } from '@/lib/auth/current';
import { writeAudit } from '@/lib/db/scope';
import { projectSchema } from '@/lib/validation';

export async function saveProjectAction(formData: FormData): Promise<void> {
  const session = await requireSessionOrThrow();
  await assertSameOrigin();

  const parsed = projectSchema.safeParse({
    id: String(formData.get('id') ?? '') || undefined,
    name: String(formData.get('name') ?? ''),
    description: String(formData.get('description') ?? ''),
    status: String(formData.get('status') ?? 'active'),
    color: String(formData.get('color') ?? '#3c60ee'),
  });
  if (!parsed.success) return;

  if (parsed.data.id) {
    await db()
      .update(projects)
      .set({
        name: parsed.data.name,
        description: parsed.data.description,
        status: parsed.data.status,
        color: parsed.data.color,
        updatedAt: new Date(),
      })
      .where(and(eq(projects.workspaceId, session.workspaceId), eq(projects.id, parsed.data.id)));
    await writeAudit({
      workspaceId: session.workspaceId,
      actorUserId: session.userId,
      action: 'project.update',
      entityType: 'project',
      entityId: parsed.data.id,
    });
  } else {
    const [project] = await db()
      .insert(projects)
      .values({
        workspaceId: session.workspaceId,
        name: parsed.data.name,
        description: parsed.data.description,
        status: parsed.data.status,
        color: parsed.data.color,
      })
      .returning();
    await writeAudit({
      workspaceId: session.workspaceId,
      actorUserId: session.userId,
      action: 'project.create',
      entityType: 'project',
      entityId: project.id,
    });
  }

  revalidatePath('/app/projects');
  revalidatePath('/app/home');
}

export async function deleteProjectAction(formData: FormData): Promise<void> {
  const session = await requireSessionOrThrow();
  await assertSameOrigin();
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  await db()
    .delete(projects)
    .where(and(eq(projects.workspaceId, session.workspaceId), eq(projects.id, id)));

  await writeAudit({
    workspaceId: session.workspaceId,
    actorUserId: session.userId,
    action: 'project.delete',
    entityType: 'project',
    entityId: id,
  });

  revalidatePath('/app/projects');
}

export async function addMilestoneAction(formData: FormData): Promise<void> {
  const session = await requireSessionOrThrow();
  await assertSameOrigin();

  const projectId = String(formData.get('projectId') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const dueRaw = String(formData.get('dueAt') ?? '');
  if (!projectId || !title) return;

  // Ownership check: the project must belong to this workspace.
  const owned = await db()
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.workspaceId, session.workspaceId), eq(projects.id, projectId)))
    .limit(1);
  if (owned.length === 0) return;

  const due = dueRaw ? new Date(dueRaw) : null;
  await db().insert(milestones).values({
    workspaceId: session.workspaceId,
    projectId,
    title: title.slice(0, 200),
    dueAt: due && !Number.isNaN(due.getTime()) ? due : null,
  });

  revalidatePath(`/app/projects/${projectId}`);
}

export async function toggleMilestoneAction(formData: FormData): Promise<void> {
  const session = await requireSessionOrThrow();
  await assertSameOrigin();

  const id = String(formData.get('id') ?? '');
  const projectId = String(formData.get('projectId') ?? '');
  const done = String(formData.get('done') ?? '') === 'true';
  if (!id) return;

  await db()
    .update(milestones)
    .set({ done: !done })
    .where(and(eq(milestones.workspaceId, session.workspaceId), eq(milestones.id, id)));

  if (projectId) revalidatePath(`/app/projects/${projectId}`);
}
