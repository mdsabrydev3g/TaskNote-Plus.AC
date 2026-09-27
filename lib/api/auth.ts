import { SESSION_COOKIE, verifySessionToken, type SessionClaims } from '@/lib/auth/session';

/**
 * Resolves the caller of an API request.
 *
 * Mobile clients send `Authorization: Bearer <token>`; the session cookie is
 * also accepted so the web app can use the same endpoints later.
 */
export async function sessionFromApiRequest(request: Request): Promise<SessionClaims | null> {
  const header = request.headers.get('authorization');
  if (header?.toLowerCase().startsWith('bearer ')) {
    const token = header.slice(7).trim();
    if (token.length > 0) return verifySessionToken(token);
    return null;
  }

  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (!match) return null;

  return verifySessionToken(decodeURIComponent(match.slice(SESSION_COOKIE.length + 1)));
}
