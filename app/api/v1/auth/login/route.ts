import { deviceHints, jsonError, jsonOk, readJson, requestIp } from '@/lib/api/http';
import { toUserDto, toWorkspaceDto } from '@/lib/api/dto';
import { authenticateAccount } from '@/lib/services/accounts';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/auth/login
 * body: { identifier | username | email, password }
 *
 * `identifier` is the current shape. `username` and `email` are accepted so
 * existing mobile builds keep working.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body) return jsonError('invalid_request', 400, 'a JSON object body is required');

  const candidate = body.identifier ?? body.username ?? body.email;
  const identifier = typeof candidate === 'string' ? candidate.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (identifier.length === 0 || password.length === 0) {
    return jsonError('invalid_request', 400, 'invalid_fields');
  }
  if (!rateLimit(`api-signin:${identifier.toLowerCase()}`, 10, 5 * 60_000).allowed) {
    return jsonError('rate_limited', 429, 'too_many_attempts');
  }

  const hints = deviceHints(request);
  const session = await authenticateAccount({
    identifier,
    password,
    deviceId: hints.deviceId,
    platform: hints.platform,
    ip: requestIp(request),
  });

  if (!session) return jsonError('unauthenticated', 401, 'invalid_credentials');

  return jsonOk({
    token: session.token,
    deviceId: session.deviceId,
    user: toUserDto(session.user),
    workspace: toWorkspaceDto(session.workspace),
  });
}
