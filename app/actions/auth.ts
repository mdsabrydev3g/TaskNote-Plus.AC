'use server';

import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { sessions, users } from '@/db/schema';
import { assertSameOrigin, requestIp } from '@/lib/auth/current';
import { passwordPolicyError } from '@/lib/auth/password';
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  verifySessionToken,
} from '@/lib/auth/session';
import { LOCALE_COOKIE } from '@/lib/i18n';
import { rateLimit } from '@/lib/rate-limit';
import { signInSchema, signUpSchema } from '@/lib/validation';
import { writeAudit } from '@/lib/db/scope';
import { authenticateAccount, registerAccount } from '@/lib/services/accounts';

export type AuthState = { error?: string; ok?: boolean };

function localeCookieOptions() {
  return { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' as const };
}

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

  const existing = await db().select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) return { error: 'emailTaken' };

  // Shared with POST /api/v1/auth/signup so both paths create identical accounts.
  const session = await registerAccount({
    name,
    email,
    password,
    workspaceName,
    locale,
    ip: await requestIp(),
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, session.token, sessionCookieOptions());
  store.set(LOCALE_COOKIE, locale, localeCookieOptions());

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
  if (!rateLimit(`signin:${email}`, 8, 5 * 60_000).allowed) return { error: 'genericError' };

  const session = await authenticateAccount({ email, password, ip: await requestIp() });
  if (!session) return { error: 'invalidCredentials' };

  const store = await cookies();
  store.set(SESSION_COOKIE, session.token, sessionCookieOptions());
  store.set(LOCALE_COOKIE, session.user.locale === 'en' ? 'en' : 'ar', localeCookieOptions());

  return { ok: true };
}

export async function signOutAction(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  store.delete(SESSION_COOKIE);
  if (!token) return;

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
  const next = locale === 'en' ? 'en' : 'ar';
  const store = await cookies();
  store.set(LOCALE_COOKIE, next, localeCookieOptions());

  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return;
  const claims = await verifySessionToken(token);
  if (!claims) return;

  await db()
    .update(users)
    .set({ locale: next, updatedAt: new Date() })
    .where(eq(users.id, claims.userId));
}
