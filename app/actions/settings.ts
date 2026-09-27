'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { and, eq, ne } from 'drizzle-orm';
import { db } from '@/db/client';
import { permissionGrants, sessions, users, workspaces } from '@/db/schema';
import { assertSameOrigin, requestIp, requireSessionOrThrow } from '@/lib/auth/current';
import { checkPasswordChange, hashPassword, verifyPassword } from '@/lib/auth/password';
import { checkUsernameChange } from '@/lib/auth/username-change';
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions } from '@/lib/auth/session';
import { rateLimit } from '@/lib/rate-limit';
import { writeAudit } from '@/lib/db/scope';
import { changePasswordSchema, changeUsernameSchema, permissionScopeSchema } from '@/lib/validation';

export async function setPermissionAction(formData: FormData): Promise<void> {
  const session = await requireSessionOrThrow();
  await assertSameOrigin();

  const scope = permissionScopeSchema.safeParse(String(formData.get('scope') ?? ''));
  const granted = String(formData.get('granted') ?? '') === 'true';
  if (!scope.success) return;

  await db()
    .update(permissionGrants)
    .set({ granted, revokedAt: granted ? null : new Date() })
    .where(
      and(
        eq(permissionGrants.workspaceId, session.workspaceId),
        eq(permissionGrants.scope, scope.data),
      ),
    );

  await writeAudit({
    workspaceId: session.workspaceId,
    actorUserId: session.userId,
    action: granted ? 'permission.grant' : 'permission.revoke',
    entityType: 'permission',
    entityId: scope.data,
    ip: await requestIp(),
  });

  revalidatePath('/app/settings/permissions');
}

export async function updateProfileAction(formData: FormData): Promise<void> {
  const session = await requireSessionOrThrow();
  await assertSameOrigin();

  const name = String(formData.get('name') ?? '').trim().slice(0, 120);
  const workspaceName = String(formData.get('workspaceName') ?? '').trim().slice(0, 120);
  const aiEnabled = formData.get('aiEnabled') === 'on';

  if (name) {
    await db()
      .update(users)
      .set({ name, aiEnabled, updatedAt: new Date() })
      .where(eq(users.id, session.userId));
  }
  if (workspaceName) {
    await db()
      .update(workspaces)
      .set({ name: workspaceName, updatedAt: new Date() })
      .where(eq(workspaces.id, session.workspaceId));
  }

  await writeAudit({
    workspaceId: session.workspaceId,
    actorUserId: session.userId,
    action: 'profile.update',
    entityType: 'user',
    entityId: session.userId,
  });

  revalidatePath('/app/settings');
}

export type ChangePasswordState = { error?: string; ok?: boolean };

/**
 * Changes the signed-in user's password.
 *
 * Requiring the current password is the security-critical part: a stolen
 * session alone must not be enough to take over the account.
 */
export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await requireSessionOrThrow();
  await assertSameOrigin();

  if (!rateLimit(`password-change:${session.userId}`, 5, 15 * 60_000).allowed) {
    return { error: 'genericError' };
  }

  const parsed = changePasswordSchema.safeParse({
    current: String(formData.get('current') ?? ''),
    next: String(formData.get('next') ?? ''),
    confirm: String(formData.get('confirm') ?? ''),
  });
  if (!parsed.success) return { error: 'requiredFields' };

  const rows = await db().select().from(users).where(eq(users.id, session.userId)).limit(1);
  const user = rows[0];
  if (!user) return { error: 'genericError' };

  const problem = checkPasswordChange({
    currentMatches: verifyPassword(parsed.data.current, user.passwordHash),
    current: parsed.data.current,
    next: parsed.data.next,
    confirm: parsed.data.confirm,
  });
  if (problem) return { error: problem };

  await db()
    .update(users)
    .set({ passwordHash: hashPassword(parsed.data.next), updatedAt: new Date() })
    .where(eq(users.id, session.userId));

  // Other devices lose their session registry entry; this device stays usable.
  // Note: the JWT in a copied cookie is still valid until it expires, because
  // the middleware validates the token without a database round-trip.
  await db()
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, session.userId), ne(sessions.deviceId, session.deviceId)));

  await writeAudit({
    workspaceId: session.workspaceId,
    actorUserId: session.userId,
    action: 'user.password_change',
    entityType: 'user',
    entityId: session.userId,
    ip: await requestIp(),
  });

  revalidatePath('/app/settings/security');
  return { ok: true };
}

export type ChangeUsernameState = { error?: string; ok?: boolean; username?: string };

/**
 * Changes the login identity. The username is what signs you in, so the current
 * password is required and uniqueness is enforced before the write.
 */
export async function changeUsernameAction(
  _prev: ChangeUsernameState,
  formData: FormData,
): Promise<ChangeUsernameState> {
  const session = await requireSessionOrThrow();
  await assertSameOrigin();

  if (!rateLimit(`username-change:${session.userId}`, 5, 15 * 60_000).allowed) {
    return { error: 'genericError' };
  }

  const parsed = changeUsernameSchema.safeParse({
    username: String(formData.get('username') ?? ''),
    currentPassword: String(formData.get('currentPassword') ?? ''),
  });
  if (!parsed.success) return { error: 'invalidUsername' };

  const rows = await db().select().from(users).where(eq(users.id, session.userId)).limit(1);
  const user = rows[0];
  if (!user) return { error: 'genericError' };

  const problem = checkUsernameChange({
    currentMatches: verifyPassword(parsed.data.currentPassword, user.passwordHash),
    currentUsername: user.username ?? '',
    nextUsername: parsed.data.username,
  });
  if (problem) return { error: problem };

  const nextUsername = parsed.data.username.trim().toLowerCase();

  const taken = await db()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, nextUsername))
    .limit(1);
  if (taken.length > 0 && taken[0].id !== session.userId) return { error: 'usernameTaken' };

  try {
    await db()
      .update(users)
      .set({ username: nextUsername, updatedAt: new Date() })
      .where(eq(users.id, session.userId));
  } catch {
    // The unique index is the last line of defence against a concurrent write.
    return { error: 'usernameTaken' };
  }

  // The session token carries the username for display, so re-issue it; the user
  // stays signed in on this device.
  const token = await createSessionToken({
    userId: session.userId,
    workspaceId: session.workspaceId,
    username: nextUsername,
    deviceId: session.deviceId,
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions());

  await writeAudit({
    workspaceId: session.workspaceId,
    actorUserId: session.userId,
    action: 'user.username_change',
    entityType: 'user',
    entityId: session.userId,
    metadata: { from: user.username, to: nextUsername },
    ip: await requestIp(),
  });

  revalidatePath('/app/settings');
  revalidatePath('/app/home');
  return { ok: true, username: nextUsername };
}
