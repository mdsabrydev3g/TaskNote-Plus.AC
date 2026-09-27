import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { users, workspaces } from '@/db/schema';
import { requireSession } from '@/lib/auth/current';
import { getTranslator } from '@/lib/i18n';
import { dictionaries } from '@/lib/i18n/dictionaries';
import { updateProfileAction } from '@/app/actions/settings';
import { ChangeUsernameForm } from '@/components/change-username-form';
import { getAIGateway } from '@/lib/ai/gateway';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await requireSession();
  const { locale } = await getTranslator();
  const dict = dictionaries[locale];

  const userRows = await db().select().from(users).where(eq(users.id, session.userId)).limit(1);
  const workspaceRows = await db()
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, session.workspaceId))
    .limit(1);

  const user = userRows[0];
  const workspace = workspaceRows[0];
  const gateway = getAIGateway();

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold">{dict.settings}</h1>
      </header>

      <section className="card">
        <h2 className="mb-3 text-sm font-semibold">{dict.profile}</h2>
        <form action={updateProfileAction} className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">
              {dict.name}
            </label>
            <input id="name" name="name" className="input" defaultValue={user?.name ?? ''} maxLength={120} />
          </div>
          <div>
            <label className="label" htmlFor="workspaceName">
              {dict.workspaceName}
            </label>
            <input
              id="workspaceName"
              name="workspaceName"
              className="input"
              defaultValue={workspace?.name ?? ''}
              maxLength={120}
            />
          </div>
          <label className="flex items-center gap-2 text-xs sm:col-span-2">
            <input type="checkbox" name="aiEnabled" defaultChecked={user?.aiEnabled ?? false} />
            {dict.permissions}
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary">
              {dict.save}
            </button>
          </div>
        </form>
      </section>

      <ChangeUsernameForm dict={dict} currentUsername={session.username} />

      <section className="card flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{dict.workspace}</h2>
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <dt className="text-muted">{dict.username}</dt>
          <dd className="truncate" dir="ltr">{session.username}</dd>
          <dt className="text-muted">{dict.language}</dt>
          <dd>{locale === 'ar' ? 'العربية (RTL)' : 'English'}</dd>
          <dt className="text-muted">{dict.aiDisabled}</dt>
          <dd>{gateway.mode === 'cloud' ? `cloud · ${gateway.provider.model}` : `local · ${gateway.reason ?? ''}`}</dd>
        </dl>
        <p className="text-[11px] text-muted">{dict.aiDisabledHint}</p>
      </section>

      <nav className="grid gap-2 sm:grid-cols-3">
        <Link href="/app/settings/security" className="card hover:border-brand-400">
          <span className="text-sm font-medium">{dict.security}</span>
          <p className="mt-1 text-xs text-muted">{dict.securityIntro}</p>
        </Link>
        <Link href="/app/settings/permissions" className="card hover:border-brand-400">
          <span className="text-sm font-medium">{dict.permissions}</span>
          <p className="mt-1 text-xs text-muted">{dict.permissionsIntro}</p>
        </Link>
        <Link href="/app/settings/audit" className="card hover:border-brand-400">
          <span className="text-sm font-medium">{dict.auditLog}</span>
          <p className="mt-1 text-xs text-muted">{dict.deviceNote}</p>
        </Link>
      </nav>
    </div>
  );
}
