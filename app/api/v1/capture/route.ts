import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { inboxItems } from '@/db/schema';
import { sessionFromApiRequest } from '@/lib/api/auth';
import { guard, jsonError, jsonOk, readJson, requestIp } from '@/lib/api/http';
import { toInboxDto } from '@/lib/api/dto';
import { contentKey } from '@/lib/hash';
import { writeAudit } from '@/lib/db/scope';
import { captureSchema } from '@/lib/validation';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUSES = ['new', 'processed', 'discarded'] as const;

/** GET /api/v1/capture?status=new|processed|discarded|all */
export async function GET(request: Request) {
  return guard(async () => {
    const session = await sessionFromApiRequest(request);
    if (!session) return jsonError('unauthenticated', 401, 'missing_or_invalid_token');

    const status = new URL(request.url).searchParams.get('status') ?? 'new';
    const where =
      status === 'all'
        ? eq(inboxItems.workspaceId, session.workspaceId)
        : and(
            eq(inboxItems.workspaceId, session.workspaceId),
            eq(inboxItems.status, (STATUSES as readonly string[]).includes(status) ? status : 'new'),
          );

    const rows = await db()
      .select()
      .from(inboxItems)
      .where(where)
      .orderBy(desc(inboxItems.createdAt))
      .limit(200);

    return jsonOk({ items: rows.map(toInboxDto) });
  });
}

/** POST /api/v1/capture - idempotent; identical text never creates a second row. */
export async function POST(request: Request) {
  return guard(async () => {
    const session = await sessionFromApiRequest(request);
    if (!session) return jsonError('unauthenticated', 401, 'missing_or_invalid_token');

    if (!rateLimit(`api-capture:${session.workspaceId}`, 120, 60_000).allowed) {
      return jsonError('rate_limited', 429, 'too_many_captures');
    }

    const body = await readJson(request);
    if (!body) return jsonError('invalid_request', 400, 'a JSON object body is required');

    const parsed = captureSchema.safeParse({
      rawText: body.rawText,
      source: body.source ?? 'text',
    });
    if (!parsed.success) return jsonError('invalid_request', 400, 'invalid_fields');

    const hash = contentKey(parsed.data.rawText);
    const inserted = await db()
      .insert(inboxItems)
      .values({
        workspaceId: session.workspaceId,
        rawText: parsed.data.rawText,
        contentHash: hash,
        source: parsed.data.source,
      })
      .onConflictDoNothing({ target: [inboxItems.workspaceId, inboxItems.contentHash] })
      .returning();

    if (inserted.length === 0) {
      const existing = await db()
        .select()
        .from(inboxItems)
        .where(
          and(eq(inboxItems.workspaceId, session.workspaceId), eq(inboxItems.contentHash, hash)),
        )
        .limit(1);
      return jsonOk({ status: 'duplicate', item: existing[0] ? toInboxDto(existing[0]) : null }, 200);
    }

    await writeAudit({
      workspaceId: session.workspaceId,
      actorUserId: session.userId,
      action: 'inbox.capture',
      entityType: 'inbox_item',
      entityId: inserted[0].id,
      ip: requestIp(request),
    });

    return jsonOk({ status: 'created', item: toInboxDto(inserted[0]) }, 201);
  });
}
