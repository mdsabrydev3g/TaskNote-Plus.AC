import { eq, or } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  deviceRegistry,
  permissionGrants,
  sessions,
  users,
  workspaceMembers,
  workspaces,
  type User,
  type Workspace,
} from '@/db/schema';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { SESSION_TTL_SECONDS, createSessionToken } from '@/lib/auth/session';
import { writeAudit } from '@/lib/db/scope';

/**
 * Account lifecycle, shared by the web server actions and the mobile API so
 * there is exactly one signup/login implementation (grants included).
 *
 * The login identity is `username`. `email` is a legacy, optional contact
 * address: it is no longer collected at signup, but accounts created before the
 * migration keep theirs and can still sign in with it.
 */

export const DEFAULT_GRANTS: Array<{ scope: string; label: string }> = [
  { scope: 'read:notes', label: 'Read notes' },
  { scope: 'read:tasks', label: 'Read tasks' },
  { scope: 'read:calendar', label: 'Read calendar' },
  { scope: 'write:tasks', label: 'Draft tasks' },
  { scope: 'write:notes', label: 'Draft notes' },
  { scope: 'write:calendar', label: 'Propose calendar blocks' },
];

export type AccountSession = {
  user: User;
  workspace: Workspace;
  token: string;
  deviceId: string;
};

export async function registerAccount(input: {
  name: string;
  username: string;
  password: string;
  workspaceName?: string;
  locale: 'ar' | 'en';
  deviceId?: string;
  deviceName?: string;
  platform?: string;
  ip?: string;
}): Promise<AccountSession> {
  const [user] = await db()
    .insert(users)
    .values({
      username: input.username.trim().toLowerCase(),
      passwordHash: hashPassword(input.password),
      name: input.name,
      locale: input.locale,
    })
    .returning();

  const [workspace] = await db()
    .insert(workspaces)
    .values({ ownerId: user.id, name: input.workspaceName?.trim() || `${input.name}'s workspace` })
    .returning();

  await db()
    .insert(workspaceMembers)
    .values({ workspaceId: workspace.id, userId: user.id, role: 'owner' });

  await db()
    .insert(permissionGrants)
    .values(
      DEFAULT_GRANTS.map((grant) => ({
        workspaceId: workspace.id,
        scope: grant.scope,
        label: grant.label,
        granted: false,
      })),
    );

  await writeAudit({
    workspaceId: workspace.id,
    actorUserId: user.id,
    action: 'user.signup',
    entityType: 'user',
    entityId: user.id,
    ip: input.ip,
  });

  return startSessionFor({
    user,
    workspace,
    deviceId: input.deviceId,
    deviceName: input.deviceName,
    platform: input.platform,
  });
}

export async function findUserByIdentifier(identifier: string): Promise<User | undefined> {
  const value = identifier.trim().toLowerCase();
  if (value.length === 0) return undefined;

  const rows = await db()
    .select()
    .from(users)
    .where(or(eq(users.username, value), eq(users.email, value)))
    .limit(1);

  return rows[0];
}

export async function authenticateAccount(input: {
  identifier: string;
  password: string;
  deviceId?: string;
  deviceName?: string;
  platform?: string;
  ip?: string;
}): Promise<AccountSession | null> {
  const user = await findUserByIdentifier(input.identifier);
  if (!user || !verifyPassword(input.password, user.passwordHash)) return null;

  const memberships = await db()
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, user.id))
    .limit(1);
  const membership = memberships[0];
  if (!membership) return null;

  const workspaceRows = await db()
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, membership.workspaceId))
    .limit(1);
  const workspace = workspaceRows[0];
  if (!workspace) return null;

  await writeAudit({
    workspaceId: workspace.id,
    actorUserId: user.id,
    action: 'user.login',
    entityType: 'user',
    entityId: user.id,
    ip: input.ip,
  });

  return startSessionFor({
    user,
    workspace,
    deviceId: input.deviceId,
    deviceName: input.deviceName,
    platform: input.platform,
  });
}

export async function startSessionFor(input: {
  user: User;
  workspace: Workspace;
  deviceId?: string;
  deviceName?: string;
  platform?: string;
}): Promise<AccountSession> {
  const deviceId = input.deviceId?.slice(0, 100) || `web-${Math.random().toString(36).slice(2, 10)}`;
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  await db().insert(sessions).values({
    userId: input.user.id,
    workspaceId: input.workspace.id,
    deviceId,
    expiresAt,
  });

  await db()
    .insert(deviceRegistry)
    .values({
      workspaceId: input.workspace.id,
      userId: input.user.id,
      deviceId,
      name: input.deviceName?.slice(0, 80) || 'Web browser',
      platform: input.platform?.slice(0, 40) || 'web',
    })
    .onConflictDoNothing();

  const token = await createSessionToken({
    userId: input.user.id,
    workspaceId: input.workspace.id,
    username: input.user.username ?? '',
    deviceId,
  });

  return { user: input.user, workspace: input.workspace, token, deviceId };
}
