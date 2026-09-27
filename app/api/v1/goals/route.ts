import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { goals, tasks } from '@/db/schema';
import { sessionFromApiRequest } from '@/lib/api/auth';
import { guard, jsonError, jsonOk, readJson, requestIp } from '@/lib/api/http';
import { toGoalDto } from '@/lib/api/dto';
import { writeAudit } from '@/lib/db/scope';
import { computeGoalProgress } from '@/lib/progress';
import { goalSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/goals - with progress rolled up from linked tasks. */
export async function GET(request: Request) {
  return guard(async () => {
    const session = await sessionFromApiRequest(request);
    if (!session) return jsonError('unauthenticated', 401, 'missing_or_invalid_token');

    const rows = await db()
      .select()
      .from(goals)
      .where(eq(goals.workspaceId, session.workspaceId))
      .orderBy(desc(goals.createdAt));

    const taskRows = await db()
      .select({ status: tasks.status, goalId: tasks.goalId })
      .from(tasks)
      .where(eq(tasks.workspaceId, session.workspaceId));

    return jsonOk({
      items: rows.map((goal) => ({ ...toGoalDto(goal), progress: computeGoalProgress(goal.id, taskRows) })),
      count: rows.length,
    });
  });
}

/** POST /api/v1/goals */
export async function POST(request: Request) {
  return guard(async () => {
    const session = await sessionFromApiRequest(request);
    if (!session) return jsonError('unauthenticated', 401, 'missing_or_invalid_token');

    const body = await readJson(request);
    if (!body) return jsonError('invalid_request', 400, 'a JSON object body is required');

    const parsed = goalSchema.safeParse({
      title: body.title,
      description: body.description ?? '',
      status: body.status ?? 'active',
      targetAt: typeof body.targetAt === 'string' ? body.targetAt : null,
    });
    if (!parsed.success) return jsonError('invalid_request', 400, 'invalid_fields');

    const target = parsed.data.targetAt ? new Date(parsed.data.targetAt) : null;

    const [goal] = await db()
      .insert(goals)
      .values({
        workspaceId: session.workspaceId,
        title: parsed.data.title,
        description: parsed.data.description,
        status: parsed.data.status,
        targetAt: target && !Number.isNaN(target.getTime()) ? target : null,
      })
      .returning();

    await writeAudit({
      workspaceId: session.workspaceId,
      actorUserId: session.userId,
      action: 'goal.create',
      entityType: 'goal',
      entityId: goal.id,
      ip: requestIp(request),
    });

    return jsonOk({ goal: toGoalDto(goal) }, 201);
  });
}
