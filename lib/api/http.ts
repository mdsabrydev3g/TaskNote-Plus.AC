import { NextResponse } from 'next/server';

/**
 * Versioned JSON API envelope.
 *   success -> { "data": ... }
 *   failure -> { "error": { "code": "...", "message": "..." } }
 */

export type ApiErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'invalid_request'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'internal_error';

const NO_STORE = { 'cache-control': 'no-store' } as const;

export function jsonOk(data: unknown, status = 200) {
  return NextResponse.json({ data }, { status, headers: NO_STORE });
}

export function jsonError(code: ApiErrorCode, status: number, message?: string) {
  return NextResponse.json(
    { error: { code, message: message ?? code } },
    { status, headers: NO_STORE },
  );
}

/** Parses a JSON body defensively; returns null instead of throwing. */
export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed = await request.json();
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/** Wraps a handler so an unexpected error becomes a clean 500 without leaking internals. */
export async function guard(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    console.error('[api] unhandled error:', error instanceof Error ? error.message : error);
    return jsonError('internal_error', 500, 'unexpected_error');
  }
}

export function requestIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

export function deviceHints(request: Request): { deviceId?: string; platform?: string } {
  const ua = request.headers.get('user-agent') ?? '';
  const deviceId = request.headers.get('x-device-id') ?? undefined;
  const platform = /iphone|ipad|android/i.test(ua) ? 'mobile' : 'unknown';
  return { deviceId, platform };
}
