import { asc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { db } from '@/db/client';
import { permissionGrants } from '@/db/schema';
import { requireSession } from '@/lib/auth/current';
import { getTranslator } from '@/lib/i18n';
import { dictionaries } from '@/lib/i18n/dictionaries';
import { setPermissionAction } from '@/app/actions/settings';

export const dynamic = 'force-dynamic';

export default async function PermissionsPage() {
  const session = await requireSession();
  const { locale } = await getTranslator();
  const dict = dictionaries[locale];

  const grants = await db()
    .select()
    .from(permissionGrants)
    .where(eq(permissionGrants.workspaceId, session.workspaceId))
    .orderBy(asc(permissionGrants.scope));

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{dict.permissions}</h1>
        <Link href="/app/settings" className="chip">
          {dict.settings}
        </Link>
      </header>

      <p className="card text-xs text-muted">{dict.permissionsIntro}</p>

      <ul className="flex flex-col gap-2">
        {grants.map((grant) => (
          <li key={grant.id} className="card flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{grant.label || grant.scope}</p>
              <p className="text-[11px] text-muted">{grant.scope}</p>
            </div>
            <form action={setPermissionAction}>
              <input type="hidden" name="scope" value={grant.scope} />
              <input type="hidden" name="granted" value={String(!grant.granted)} />
              <button
                type="submit"
                className={grant.granted ? 'btn-ghost px-3 py-1.5 text-xs' : 'btn-primary px-3 py-1.5 text-xs'}
                aria-pressed={grant.granted}
              >
                {grant.granted ? dict.delete : dict.create}
              </button>
            </form>
          </li>
        ))}
        {grants.length === 0 && <li className="card text-center text-sm text-muted">—</li>}
      </ul>
    </div>
  );
}
