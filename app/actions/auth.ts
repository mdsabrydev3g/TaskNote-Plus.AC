'use server';

import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  deviceRegistry,
  permissionGrants,
  sessions,
  users,
  workspaceMembers,
  workspaces,
} from '@/db/schema';
import { assertSameOrigin, requestIp } from '@/lib/auth/current';
import { hashPassword, passwordPolicyError, verifyPassword } from '@/lib/auth/password';
import { SESSION_COOKIE, SESSION_TTL_SECONDS, createSessionToken, sessionCookieOptions } from '@/lib/auth/session';
import { LOCALE_COOKIE } from '@/lib/i18n';
import { rateLimit } from '@/lib/rate-limit';
import { signInSchema, signUpSchema } from '@/lib/validation';
import { writeAudit } from '@/lib/db/scope';

export type AuthState = { error?: string; ok?: boolean };

const DEFAULT_GRANTS: Array<{ scope: string; label: string }> = [
  { scope: 'read:notes', label: 'Read notes' },
  { scope: 'read:tasks', label: 'Read tasks' },
  { scope: 'read:calendar', label: 'Read calendar' },
  { scope: 'write:tasks', label: 'Draft tasks' },
  { scope: 'write:notes', label: 'Draft notes' },
  { scope: 'write:calendar', label: 'Propose calendar blocks' },
];

export async function signUpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  try {
    await assertSameOrigin();
  } catch {
    return { error: 'genericError' };
  }

  const parsed = signUpSchema.safeParse({
    name: String(formData.get('name') ?? ''),
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
    workspaceName: String(formData.get('workspaceName') ?? '') || undefined,
    locale: String(formData.get('locale') ?? 'ar'),
  });

  if (!parsed.success) return { error: 'requiredFields' };
  const { name, email, password, workspaceName, locale } = parsed.data;

  if (passwordPolicyError(password)) return { error: 'weakPassword' };
  if (!rateLimit(`signup:${email}`, 5, 10 * 60_000).allowed) return { error: 'genericError' };

  const existing = await db().select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) return { error: 'emailTaken' };

  const [user] = await db()
    .insert(users)
    .values({ email, passwordHash: hashPassword(password), name, locale })
    .returning();

  const [workspace] = await db()
    .insert(workspaces)
    .values({ ownerId: user.id, name: workspaceName?.trim() || `${name}'s workspace` })
    .returning();

  await db().insert(workspaceMembers).values({
    workspaceId: workspace.id,
    userId: user.id,
    role: 'owner',
  });

  await db().insert(permissionGrants).values(
    DEFAULT_GRANTS.map((g) => ({
      workspaceId: workspace.id,
      scope: g.scope,
      label: g.label,
      granted: false,
    })),
  );

  await startSession({ userId: user.id, workspaceId: workspace.id, email, name: user.name });
  await writeAudit({
    workspaceId: workspace.id,
    actorUserId: user.id,
    action: 'user.signup',
    entityType: 'user',
    entityId: user.id,
    ip: await requestIp(),
  });

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });

  return { ok: true };
}

export async function signInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  try {
    await assertSameOrigin();
  } catch {
    return { error: 'genericError' };
  }

  const parsed = signInSchema.safeParse({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  });
  if (!parsed.success) return { error: 'invalidCredentials' };

  const { email, password } = parsed.data;
  const limit = rateLimit(`signin:${email}`, 8, 5 * 60_000);
  if (!limit.allowed) return { error: 'genericError' };

  const rows = await db().select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { error: 'invalidCredentials' };
  }

  const memberships = await db()
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, user.id))
    .limit(1);
  const membership = memberships[0];
  if (!membership) return { error: 'genericError' };

  await startSession({
    userId: user.id,
    workspaceId: membership.workspaceId,
    email: user.email,
    name: user.name,
  });

  const store = await cookies();
  store.set(LOCALE_COOKIE, user.locale === 'en' ? 'en' : 'ar', {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });

  await writeAudit({
    workspaceId: membership.workspaceId,
    actorUserId: user.id,
    action: 'user.login',
    entityType: 'user',
    entityId: user.id,
    ip: await requestIp(),
  });

  return { ok: true };
}

export async function signOutAction(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  store.delete(SESSION_COOKIE);
  if (!token) return;

  const { verifySessionToken } = await import('@/lib/auth/session');
  const claims = await verifySessionToken(token);
  if (claims) {
    await db()
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.userId, claims.userId));
    await writeAudit({
      workspaceId: claims.workspaceId,
      actorUserId: claims.userId,
      action: 'user.logout',
    });
  }
}

export async function setLocaleAction(locale: string): Promise<void> {
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale === 'en' ? 'en' : 'ar', {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });

  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const { verifySessionToken } = await import('@/lib/auth/session');
    const claims = await verifySessionToken(token);
    if (claims) {
      await db()
        .update(users)
        .set({ locale: locale === 'en' ? 'en' : 'ar', updatedAt: new Date() })
        .where(eq(users.id, claims.userId));
    }
  }
}

async function startSession(input: {
  userId: string;
  workspaceId: string;
  email: string;
  name: string;
}): Promise<void> {
  const deviceId = `web-${Math.random().toString(36).slice(2, 10)}`;
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  await db().insert(sessions).values({
    userId: input.userId,
    workspaceId: input.workspaceId,
    deviceId,
    expiresAt,
  });

  await db()
    .insert(deviceRegistry)
    .values({
      workspaceId: input.workspaceId,
      userId: input.userId,
      deviceId,
      name: 'Web browser',
      platform: 'web',
    })
    .onConflictDoNothing();

  const token = await createSessionToken({
    userId: input.userId,
    workspaceId: input.workspaceId,
    email: input.email,
    deviceId,
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions());
}
