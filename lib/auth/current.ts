import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, verifySessionToken, type SessionClaims } from './session';

/** Reads and verifies the session on the server. Never trusts client payloads. */
export async function getSession(): Promise<SessionClaims | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireSession(): Promise<SessionClaims> {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}

export async function requireSessionOrThrow(): Promise<SessionClaims> {
  const session = await getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  return session;
}

export async function requestIp(): Promise<string> {
  const h = await headers();
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    h.get('x-real-ip') ??
    'unknown'
  );
}

/**
 * Minimal CSRF defence for server actions: same-origin check.
 * (SameSite=Lax on the session cookie is the second layer.)
 */
export async function assertSameOrigin(): Promise<void> {
  const h = await headers();
  const origin = h.get('origin');
  if (!origin) return; // non-browser callers have no session cookie to abuse
  const host = h.get('host');
  const allowed = new Set<string>();
  if (host) {
    allowed.add(`https://${host}`);
    allowed.add(`http://${host}`);
  }
  const appUrl = process.env.APP_URL;
  if (appUrl) allowed.add(appUrl.replace(/\/$/, ''));
  if (!allowed.has(origin.replace(/\/$/, ''))) {
    throw new Error('CSRF_ORIGIN_REJECTED');
  }
}
