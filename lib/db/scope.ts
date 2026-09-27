import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  auditLogs,
  goals,
  inboxItems,
  notes,
  projects,
  tasks,
  type Task,
} from '@/db/schema';

/**
 * Workspace scoping guard.
 *
 * Every tenant-scoped read/write funnels through here. A missing or malformed
 * workspace id is a hard error, never an implicitly-unscoped query.
 */
export function assertWorkspaceId(workspaceId: unknown): string {
  if (typeof workspaceId !== 'string' || workspaceId.trim().length < 8) {
    throw new Error('WORKSPACE_SCOPE_VIOLATION: a valid workspaceId is required for every query.');
  }
  return workspaceId;
}

export function scopedWhere<T extends { workspaceId: unknown }>(
  table: T,
  workspaceId: unknown,
): ReturnType<typeof eq> {
  const ws = assertWorkspaceId(workspaceId);
  return eq(table.workspaceId as never, ws) as ReturnType<typeof eq>;
}

/** Tenant-scoped task queries. There is deliberately no unscoped variant. */
export const scopedTasks = {
  async list(workspaceId: string): Promise<Task[]> {
    const ws = assertWorkspaceId(workspaceId);
    return db().select().from(tasks).where(eq(tasks.workspaceId, ws));
  },
  async byProject(workspaceId: string, projectId: string): Promise<Task[]> {
    const ws = assertWorkspaceId(workspaceId);
    return db()
      .select()
      .from(tasks)
      .where(and(eq(tasks.workspaceId, ws), eq(tasks.projectId, projectId)));
  },
};

export const scopedNotes = {
  async list(workspaceId: string) {
    const ws = assertWorkspaceId(workspaceId);
    return db().select().from(notes).where(eq(notes.workspaceId, ws));
  },
};

export const scopedProjects = {
  async list(workspaceId: string) {
    const ws = assertWorkspaceId(workspaceId);
    return db().select().from(projects).where(eq(projects.workspaceId, ws));
  },
};

export const scopedGoals = {
  async list(workspaceId: string) {
    const ws = assertWorkspaceId(workspaceId);
    return db().select().from(goals).where(eq(goals.workspaceId, ws));
  },
};

export const scopedInbox = {
  async list(workspaceId: string) {
    const ws = assertWorkspaceId(workspaceId);
    return db().select().from(inboxItems).where(eq(inboxItems.workspaceId, ws));
  },
};

export async function writeAudit(input: {
  workspaceId: string;
  actorUserId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}): Promise<void> {
  await db()
    .insert(auditLogs)
    .values({
      workspaceId: assertWorkspaceId(input.workspaceId),
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType ?? '',
      entityId: input.entityId ?? '',
      metadata: input.metadata ?? {},
      ip: input.ip ?? '',
    });
}
