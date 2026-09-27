import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { tasks } from '@/db/schema';
import { sessionFromApiRequest } from '@/lib/api/auth';
import { guard, jsonError, jsonOk, readJson } from '@/lib/api/http';
import { toTaskDto } from '@/lib/api/dto';
import { writeAudit } from '@/lib/db/scope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

const STATUSES = ['todo', 'doing', 'done'] as const;
const ENERGY = ['deep', 'light', 'admin'] as const;

async function load(workspaceId: string, id: string) {
  const rows = await db()
    .select()
    .from(tasks)
    .where(and(eq(tasks.workspaceId, workspaceId), eq(tasks.id, id)))
    .limit(1);
  return rows[0];
}

/** GET /api/v1/tasks/:id */
export async function GET(request: Request, { params }: Params) {
  return guard(async () => {
    const session = await sessionFromApiRequest(request);
    if (!session) return jsonError('unauthenticated', 401, 'missing_or_invalid_token');
    const { id } = await params;

    const task = await load(session.workspaceId, id);
    if (!task) return jsonError('not_found', 404, 'task_not_found');
    return jsonOk({ task: toTaskDto(task) });
  });
}

/** PATCH /api/v1/tasks/:id - only the supplied fields change. */
export async function PATCH(request: Request, { params }: Params) {
  return guard(async () => {
    const session = await sessionFromApiRequest(request);
    if (!session) return jsonError('unauthenticated', 401, 'missing_or_invalid_token');
    const { id } = await params;

    const body = await readJson(request);
    if (!body) return jsonError('invalid_request', 400, 'a JSON object body is required');

    const existing = await load(session.workspaceId, id);
    if (!existing) return jsonError('not_found', 404, 'task_not_found');

    const patch: Record<string, unknown> = { updatedAt: new Date() };

    if (typeof body.title === 'string' && body.title.trim().length > 0) {
      patch.title = body.title.trim().slice(0, 500);
    }
    if (typeof body.description === 'string') patch.description = body.description.slice(0, 20000);
    if (typeof body.status === 'string') {
      if (!(STATUSES as readonly string[]).includes(body.status)) {
        return jsonError('invalid_request', 400, 'invalid_status');
      }
      patch.status = body.status;
      patch.completedAt = body.status === 'done' ? new Date() : null;
    }
    if (typeof body.energy === 'string') {
      if (!(ENERGY as readonly string[]).includes(body.energy)) {
        return jsonError('invalid_request', 400, 'invalid_energy');
      }
      patch.energy = body.energy;
    }
    if (body.priority !== undefined) {
      const priority = Number(body.priority);
      if (!Number.isInteger(priority) || priority < 0 || priority > 3) {
        return jsonError('invalid_request', 400, 'invalid_priority');
      }
      patch.priority = priority;
    }
    for (const field of ['dueAt', 'deferAt'] as const) {
      if (field in body) {
        const raw = body[field];
        if (raw === null) {
          patch[field] = null;
        } else if (typeof raw === 'string') {
          const date = new Date(raw);
          if (Number.isNaN(date.getTime())) return jsonError('invalid_request', 400, `invalid_${field}`);
          patch[field] = date;
        } else {
          return jsonError('invalid_request', 400, `invalid_${field}`);
        }
      }
    }
    for (const field of ['projectId', 'goalId'] as const) {
      if (field in body) {
        const raw = body[field];
        if (raw === null || raw === '') patch[field] = null;
        else if (typeof raw === 'string') patch[field] = raw;
        else return jsonError('invalid_request', 400, `invalid_${field}`);
      }
    }

    const [updated] = await db()
      .update(tasks)
      .set(patch)
      .where(and(eq(tasks.workspaceId, session.workspaceId), eq(tasks.id, id)))
      .returning();

    await writeAudit({
      workspaceId: session.workspaceId,
      actorUserId: session.userId,
      action: 'task.update',
      entityType: 'task',
      entityId: id,
    });

    return jsonOk({ task: toTaskDto(updated) });
  });
}

/** DELETE /api/v1/tasks/:id */
export async function DELETE(request: Request, { params }: Params) {
  return guard(async () => {
    const session = await sessionFromApiRequest(request);
    if (!session) return jsonError('unauthenticated', 401, 'missing_or_invalid_token');
    const { id } = await params;

    const existing = await load(session.workspaceId, id);
    if (!existing) return jsonError('not_found', 404, 'task_not_found');

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

    return jsonOk({ deleted: true, id });
  });
}
