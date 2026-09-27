import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { goals, notes, projects, tasks } from '@/db/schema';
import { assertWorkspaceId } from '@/lib/db/scope';

export type SearchType = 'note' | 'task' | 'project' | 'goal';

export type SearchHit = {
  type: SearchType;
  id: string;
  title: string;
  snippet: string;
  updatedAt: Date | null;
};

export type SearchOutcome = {
  hits: SearchHit[];
  mode: 'fts' | 'ilike';
};

function snippet(text: string, query: string, length = 160): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const index = flat.toLowerCase().indexOf(query.toLowerCase());
  if (index <= 40) return flat.slice(0, length);
  return `…${flat.slice(Math.max(0, index - 40), index - 40 + length)}`;
}

/**
 * Hybrid retrieval: Postgres full-text rank when the deployment supports it,
 * with an automatic ILIKE fallback so search never hard-fails.
 */
export async function searchWorkspace(
  workspaceId: string,
  query: string,
  types: SearchType[] = ['note', 'task', 'project', 'goal'],
): Promise<SearchOutcome> {
  const ws = assertWorkspaceId(workspaceId);
  const q = query.trim();
  if (q.length === 0) return { hits: [], mode: 'fts' };

  try {
    return { hits: await runSearch(ws, q, types, true), mode: 'fts' };
  } catch {
    return { hits: await runSearch(ws, q, types, false), mode: 'ilike' };
  }
}

async function runSearch(
  ws: string,
  q: string,
  types: SearchType[],
  fts: boolean,
): Promise<SearchHit[]> {
  const like = `%${q}%`;
  const hits: SearchHit[] = [];

  const textMatch = (parts: ReturnType<typeof sql>[]) => or(...parts);

  if (types.includes('note')) {
    const vector = sql`to_tsvector('simple', coalesce(${notes.title}, '') || ' ' || coalesce(${notes.body}, ''))`;
    const match = fts
      ? textMatch([ilike(notes.title, like), ilike(notes.body, like), sql`${vector} @@ plainto_tsquery('simple', ${q})`])
      : textMatch([ilike(notes.title, like), ilike(notes.body, like)]);
    const rows = await db()
      .select()
      .from(notes)
      .where(and(eq(notes.workspaceId, ws), match))
      .orderBy(desc(notes.updatedAt))
      .limit(20);
    for (const row of rows) {
      hits.push({
        type: 'note',
        id: row.id,
        title: row.title || '—',
        snippet: snippet(row.body, q),
        updatedAt: row.updatedAt,
      });
    }
  }

  if (types.includes('task')) {
    const vector = sql`to_tsvector('simple', coalesce(${tasks.title}, '') || ' ' || coalesce(${tasks.description}, ''))`;
    const match = fts
      ? textMatch([ilike(tasks.title, like), ilike(tasks.description, like), sql`${vector} @@ plainto_tsquery('simple', ${q})`])
      : textMatch([ilike(tasks.title, like), ilike(tasks.description, like)]);
    const rows = await db()
      .select()
      .from(tasks)
      .where(and(eq(tasks.workspaceId, ws), match))
      .orderBy(desc(tasks.updatedAt))
      .limit(20);
    for (const row of rows) {
      hits.push({
        type: 'task',
        id: row.id,
        title: row.title,
        snippet: row.description || row.status,
        updatedAt: row.updatedAt,
      });
    }
  }

  if (types.includes('project')) {
    const match = textMatch([ilike(projects.name, like), ilike(projects.description, like)]);
    const rows = await db()
      .select()
      .from(projects)
      .where(and(eq(projects.workspaceId, ws), match))
      .limit(20);
    for (const row of rows) {
      hits.push({
        type: 'project',
        id: row.id,
        title: row.name,
        snippet: snippet(row.description, q),
        updatedAt: row.updatedAt,
      });
    }
  }

  if (types.includes('goal')) {
    const match = textMatch([ilike(goals.title, like), ilike(goals.description, like)]);
    const rows = await db()
      .select()
      .from(goals)
      .where(and(eq(goals.workspaceId, ws), match))
      .limit(20);
    for (const row of rows) {
      hits.push({
        type: 'goal',
        id: row.id,
        title: row.title,
        snippet: snippet(row.description, q),
        updatedAt: row.updatedAt,
      });
    }
  }

  return hits;
}

export function hitHref(hit: SearchHit): string {
  switch (hit.type) {
    case 'note':
      return `/app/notes/${hit.id}`;
    case 'project':
      return `/app/projects/${hit.id}`;
    case 'task':
      return '/app/tasks';
    case 'goal':
      return '/app/goals';
  }
}
