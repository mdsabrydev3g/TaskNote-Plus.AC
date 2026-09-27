import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'tn_session';
export const CSRF_COOKIE = 'tn_csrf';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type SessionClaims = {
  userId: string;
  workspaceId: string;
  /** Login identity. Older tokens carry `email` here instead; see verifySessionToken. */
  username: string;
  deviceId: string;
};

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= 32) return new TextEncoder().encode(secret);

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'AUTH_SECRET_MISSING: set AUTH_SECRET (32+ random bytes) in your environment before running in production.',
    );
  }
  // Dev-only deterministic fallback so `next build` and local dev work without .env.
  return new TextEncoder().encode('tasknote-plus-dev-only-insecure-secret-key-0001');
}

export async function createSessionToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('tasknote-plus')
    .setAudience('tasknote-plus-web')
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: 'tasknote-plus',
      audience: 'tasknote-plus-web',
    });

    if (typeof payload.userId !== 'string' || typeof payload.workspaceId !== 'string') return null;

    // Tokens issued before the username migration carry `email`; keep accepting
    // them so a deploy does not sign everybody out.
    const username =
      typeof payload.username === 'string'
        ? payload.username
        : typeof payload.email === 'string'
          ? payload.email
          : '';

    return {
      userId: payload.userId,
      workspaceId: payload.workspaceId,
      username,
      deviceId: typeof payload.deviceId === 'string' ? payload.deviceId : 'web',
    };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}
