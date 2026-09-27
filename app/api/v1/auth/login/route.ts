import { deviceHints, jsonError, jsonOk, readJson, requestIp } from '@/lib/api/http';
import { toUserDto, toWorkspaceDto } from '@/lib/api/dto';
import { authenticateAccount } from '@/lib/services/accounts';
import { rateLimit } from '@/lib/rate-limit';
import { signInSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/auth/login */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body) return jsonError('invalid_request', 400, 'a JSON object body is required');

  const parsed = signInSchema.safeParse({ email: body.email, password: body.password });
  if (!parsed.success) return jsonError('invalid_request', 400, 'invalid_fields');

  if (!rateLimit(`api-signin:${parsed.data.email}`, 10, 5 * 60_000).allowed) {
    return jsonError('rate_limited', 429, 'too_many_attempts');
  }

  const hints = deviceHints(request);
  const session = await authenticateAccount({
    email: parsed.data.email,
    password: parsed.data.password,
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
