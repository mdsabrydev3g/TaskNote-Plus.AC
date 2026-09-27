import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { permissionGrants, users, workspaces } from '@/db/schema';
import { sessionFromApiRequest } from '@/lib/api/auth';
import { jsonError, jsonOk } from '@/lib/api/http';
import { toUserDto, toWorkspaceDto } from '@/lib/api/dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/v1/me - identity plus the AI grants the client should respect. */
export async function GET(request: Request) {
  const session = await sessionFromApiRequest(request);
  if (!session) return jsonError('unauthenticated', 401, 'missing_or_invalid_token');

  const [userRow] = await db().select().from(users).where(eq(users.id, session.userId)).limit(1);
  const [workspaceRow] = await db()
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, session.workspaceId))
    .limit(1);
  if (!userRow || !workspaceRow) return jsonError('unauthenticated', 401, 'account_not_found');

  const grants = await db()
    .select()
    .from(permissionGrants)
    .where(eq(permissionGrants.workspaceId, session.workspaceId))
    .orderBy(asc(permissionGrants.scope));

  return jsonOk({
    user: toUserDto(userRow),
    workspace: toWorkspaceDto(workspaceRow),
    deviceId: session.deviceId,
    permissions: grants.map((grant) => ({
      scope: grant.scope,
      label: grant.label,
      granted: grant.granted && !grant.revokedAt,
    })),
  });
}
