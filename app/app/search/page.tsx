import Link from 'next/link';
import { requireSession } from '@/lib/auth/current';
import { getTranslator } from '@/lib/i18n';
import { dictionaries } from '@/lib/i18n/dictionaries';
import { hitHref, searchWorkspace, type SearchType } from '@/lib/search';

export const dynamic = 'force-dynamic';

const ALL_TYPES: SearchType[] = ['note', 'task', 'project', 'goal'];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; types?: string }>;
}) {
  const params = await searchParams;
  const session = await requireSession();
  const { locale } = await getTranslator();
  const dict = dictionaries[locale];

  const q = (params.q ?? '').trim();
  const active = (params.types?.split(',').filter((t): t is SearchType =>
    (ALL_TYPES as string[]).includes(t),
  ) ?? ALL_TYPES) as SearchType[];

  const outcome = q ? await searchWorkspace(session.workspaceId, q, active) : { hits: [], mode: 'fts' as const };

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold">{dict.search}</h1>
      </header>

      <form className="card flex gap-2" method="get" action="/app/search">
        <input
          name="q"
          className="input"
          defaultValue={q}
          placeholder={dict.searchPlaceholder}
          aria-label={dict.searchPlaceholder}
          autoFocus
        />
        <button type="submit" className="btn-primary shrink-0">
          {dict.search}
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        <Link href={`/app/search?q=${encodeURIComponent(q)}`} className={`chip ${active.length === 4 ? 'chip-active' : ''}`}>
          {dict.allTypes}
        </Link>
        {ALL_TYPES.map((type) => (
          <Link
            key={type}
            href={`/app/search?q=${encodeURIComponent(q)}&types=${type}`}
            className={`chip ${active.length === 1 && active[0] === type ? 'chip-active' : ''}`}
          >
            {type === 'note' ? dict.notes : type === 'task' ? dict.tasks : type === 'project' ? dict.projects : dict.goals}
          </Link>
        ))}
      </div>

      {q.length === 0 ? (
        <p className="card py-8 text-center text-sm text-muted">{dict.searchPlaceholder}</p>
      ) : outcome.hits.length === 0 ? (
        <p className="card py-8 text-center text-sm text-muted">{dict.noResults}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {outcome.hits.map((hit) => (
            <li key={`${hit.type}:${hit.id}`}>
              <Link href={hitHref(hit)} className="card block hover:border-brand-400">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{hit.title}</span>
                  <span className="chip shrink-0">{hit.type}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted">{hit.snippet}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
