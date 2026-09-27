import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { passwordPolicyError } from '@/lib/auth/password';
import { deviceHints, jsonError, jsonOk, readJson, requestIp } from '@/lib/api/http';
import { toUserDto, toWorkspaceDto } from '@/lib/api/dto';
import { registerAccount } from '@/lib/services/accounts';
import { rateLimit } from '@/lib/rate-limit';
import { signUpSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/v1/auth/signup */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body) return jsonError('invalid_request', 400, 'a JSON object body is required');

  const parsed = signUpSchema.safeParse({
    name: body.name,
    email: body.email,
    password: body.password,
    workspaceName: typeof body.workspaceName === 'string' ? body.workspaceName : undefined,
    locale: body.locale ?? 'ar',
  });
  if (!parsed.success) return jsonError('invalid_request', 400, 'invalid_fields');
  if (passwordPolicyError(parsed.data.password)) {
    return jsonError('invalid_request', 400, 'weak_password');
  }
  if (!rateLimit(`api-signup:${parsed.data.email}`, 5, 10 * 60_000).allowed) {
    return jsonError('rate_limited', 429, 'too_many_signups');
  }

  const existing = await db()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);
  if (existing.length > 0) return jsonError('conflict', 409, 'email_taken');

  const hints = deviceHints(request);
  const session = await registerAccount({
    name: parsed.data.name,
    email: parsed.data.email,
    password: parsed.data.password,
    workspaceName: parsed.data.workspaceName,
    locale: parsed.data.locale,
    deviceId: hints.deviceId,
    platform: hints.platform,
    ip: requestIp(request),
  });

  return jsonOk(
    {
      token: session.token,
      deviceId: session.deviceId,
      user: toUserDto(session.user),
      workspace: toWorkspaceDto(session.workspace),
    },
    201,
  );
}
