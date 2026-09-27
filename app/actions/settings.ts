'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, ne } from 'drizzle-orm';
import { db } from '@/db/client';
import { permissionGrants, sessions, users, workspaces } from '@/db/schema';
import { assertSameOrigin, requestIp, requireSessionOrThrow } from '@/lib/auth/current';
import { checkPasswordChange, hashPassword, verifyPassword } from '@/lib/auth/password';
import { rateLimit } from '@/lib/rate-limit';
import { writeAudit } from '@/lib/db/scope';
import { changePasswordSchema, permissionScopeSchema } from '@/lib/validation';

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
