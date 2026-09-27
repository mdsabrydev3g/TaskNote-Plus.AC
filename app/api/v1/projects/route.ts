import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { milestones, projects, tasks } from '@/db/schema';
import { sessionFromApiRequest } from '@/lib/api/auth';
import { guard, jsonError, jsonOk, readJson, requestIp } from '@/lib/api/http';
import { toMilestoneDto, toProjectDto } from '@/lib/api/dto';
import { writeAudit } from '@/lib/db/scope';
import { computeProjectProgress } from '@/lib/progress';
import { projectSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/projects - with progress rolled up from child tasks. */
export async function GET(request: Request) {
  return guard(async () => {
    const session = await sessionFromApiRequest(request);
    if (!session) return jsonError('unauthenticated', 401, 'missing_or_invalid_token');

    const rows = await db()
      .select()
      .from(projects)
      .where(eq(projects.workspaceId, session.workspaceId))
      .orderBy(desc(projects.createdAt));

    const taskRows = await db()
      .select({ status: tasks.status, projectId: tasks.projectId })
      .from(tasks)
      .where(eq(tasks.workspaceId, session.workspaceId));

    return jsonOk({
      items: rows.map((project) => ({
        ...toProjectDto(project),
        progress: computeProjectProgress(project.id, taskRows),
      })),
      count: rows.length,
    });
  });
}

/** POST /api/v1/projects */
export async function POST(request: Request) {
  return guard(async () => {
    const session = await sessionFromApiRequest(request);
    if (!session) return jsonError('unauthenticated', 401, 'missing_or_invalid_token');

    const body = await readJson(request);
    if (!body) return jsonError('invalid_request', 400, 'a JSON object body is required');

    const parsed = projectSchema.safeParse({
      name: body.name,
      description: body.description ?? '',
      status: body.status ?? 'active',
      color: body.color ?? '#3c60ee',
    });
    if (!parsed.success) return jsonError('invalid_request', 400, 'invalid_fields');

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
      ip: requestIp(request),
    });

    return jsonOk({ project: toProjectDto(project), milestones: [] as ReturnType<typeof toMilestoneDto>[] }, 201);
  });
}
