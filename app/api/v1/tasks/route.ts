import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { tasks } from '@/db/schema';
import { sessionFromApiRequest } from '@/lib/api/auth';
import { guard, jsonError, jsonOk, readJson, requestIp } from '@/lib/api/http';
import { toTaskDto } from '@/lib/api/dto';
import { writeAudit } from '@/lib/db/scope';
import { parseQuickAdd } from '@/lib/nl-quickadd';
import { isActionable } from '@/lib/progress';
import { rateLimit } from '@/lib/rate-limit';
import { taskCreateSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** GET /api/v1/tasks?filter=open|today|done|all&projectId=&goalId= */
export async function GET(request: Request) {
  return guard(async () => {
    const session = await sessionFromApiRequest(request);
    if (!session) return jsonError('unauthenticated', 401, 'missing_or_invalid_token');

    const url = new URL(request.url);
    const filter = url.searchParams.get('filter') ?? 'open';
    const projectId = url.searchParams.get('projectId');
    const goalId = url.searchParams.get('goalId');

    const rows = await db()
      .select()
      .from(tasks)
      .where(eq(tasks.workspaceId, session.workspaceId))
      .orderBy(desc(tasks.createdAt))
      .limit(500);

    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const filtered = rows.filter((task) => {
      if (projectId && task.projectId !== projectId) return false;
      if (goalId && task.goalId !== goalId) return false;
      if (filter === 'done') return task.status === 'done';
      if (filter === 'today') {
        return isActionable(task, now) && Boolean(task.dueAt) && new Date(task.dueAt as Date) <= endOfDay;
      }
      if (filter === 'all') return true;
      return task.status !== 'done';
    });

    return jsonOk({ items: filtered.map(toTaskDto), count: filtered.length });
  });
}

/** POST /api/v1/tasks - either structured fields or { quick: "..." } natural language. */
export async function POST(request: Request) {
  return guard(async () => {
    const session = await sessionFromApiRequest(request);
    if (!session) return jsonError('unauthenticated', 401, 'missing_or_invalid_token');

    if (!rateLimit(`api-tasks:${session.workspaceId}`, 120, 60_000).allowed) {
      return jsonError('rate_limited', 429, 'too_many_writes');
    }

    const body = await readJson(request);
    if (!body) return jsonError('invalid_request', 400, 'a JSON object body is required');

    // Natural-language path: same deterministic parser the web app uses.
    if (typeof body.quick === 'string' && body.quick.trim().length > 0) {
      const parsed = parseQuickAdd(body.quick, new Date());
      const [task] = await db()
        .insert(tasks)
        .values({
          workspaceId: session.workspaceId,
          title: parsed.title || body.quick.trim().slice(0, 200),
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
        ip: requestIp(request),
      });

      return jsonOk({ task: toTaskDto(task), parsed }, 201);
    }

    const parsed = taskCreateSchema.safeParse({
      title: body.title,
      description: body.description ?? '',
      projectId: body.projectId ?? null,
      goalId: body.goalId ?? null,
      parentId: body.parentId ?? null,
      status: body.status ?? 'todo',
      priority: body.priority ?? 1,
      energy: body.energy ?? 'admin',
      dueAt: typeof body.dueAt === 'string' ? body.dueAt : null,
      deferAt: typeof body.deferAt === 'string' ? body.deferAt : null,
    });
    if (!parsed.success) return jsonError('invalid_request', 400, 'invalid_fields');

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
      ip: requestIp(request),
    });

    return jsonOk({ task: toTaskDto(task) }, 201);
  });
}
