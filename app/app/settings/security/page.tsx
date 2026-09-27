import Link from 'next/link';
import { requireSession } from '@/lib/auth/current';
import { getTranslator } from '@/lib/i18n';
import { dictionaries } from '@/lib/i18n/dictionaries';
import { ChangePasswordForm } from '@/components/change-password-form';

export const dynamic = 'force-dynamic';

export default async function SecurityPage() {
  await requireSession();
  const { locale } = await getTranslator();
  const dict = dictionaries[locale];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{dict.security}</h1>
        <Link href="/app/settings" className="chip">
          {dict.settings}
        </Link>
      </header>

      <p className="card text-xs text-muted">{dict.securityIntro}</p>

      <ChangePasswordForm dict={dict} />
    </div>
  );
}
