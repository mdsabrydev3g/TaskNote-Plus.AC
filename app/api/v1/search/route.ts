import { sessionFromApiRequest } from '@/lib/api/auth';
import { guard, jsonError, jsonOk } from '@/lib/api/http';
import { searchWorkspace, type SearchType } from '@/lib/search';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALL_TYPES: SearchType[] = ['note', 'task', 'project', 'goal'];

/** GET /api/v1/search?q=&types=note,task */
export async function GET(request: Request) {
  return guard(async () => {
    const session = await sessionFromApiRequest(request);
    if (!session) return jsonError('unauthenticated', 401, 'missing_or_invalid_token');

    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').trim();
    if (q.length === 0) return jsonError('invalid_request', 400, 'missing_query');
    if (q.length > 200) return jsonError('invalid_request', 400, 'query_too_long');

    const requested = (url.searchParams.get('types') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter((value): value is SearchType => (ALL_TYPES as string[]).includes(value));

    const types = requested.length > 0 ? requested : ALL_TYPES;
    const outcome = await searchWorkspace(session.workspaceId, q, types);

    return jsonOk({
      query: q,
      mode: outcome.mode,
      count: outcome.hits.length,
      items: outcome.hits.map((hit) => ({
        type: hit.type,
        id: hit.id,
        title: hit.title,
        snippet: hit.snippet,
        updatedAt: hit.updatedAt ? new Date(hit.updatedAt).toISOString() : null,
      })),
    });
  });
}
