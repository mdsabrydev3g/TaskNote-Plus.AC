import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Liveness + database reachability probe.
 *
 * Deliberately returns no configuration details: only whether the runtime can
 * reach Postgres. Safe to leave public.
 */
export async function GET() {
  const startedAt = Date.now();
  const base = { app: 'TaskNote Plus', version: '0.1.0' };

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ...base, status: 'degraded', database: 'not_configured' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }

  try {
    await db().execute(sql`select 1 as ok`);
    return NextResponse.json(
      { ...base, status: 'ok', database: 'reachable', latencyMs: Date.now() - startedAt },
      { status: 200, headers: { 'cache-control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { ...base, status: 'error', database: 'unreachable', latencyMs: Date.now() - startedAt },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }
}
