import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/current';
import { getTranslator } from '@/lib/i18n';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session) redirect('/app/home');
  const { t } = await getTranslator();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-surface px-5 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-3">
          <span
            aria-hidden="true"
            className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-600 text-lg font-bold text-white"
          >
            ✓
          </span>
          <span className="text-center">
            <span className="block text-xl font-semibold">{t('appName')}</span>
            <span className="block text-xs text-muted">{t('tagline')}</span>
          </span>
        </Link>
        {children}
      </div>
      <p className="max-w-md text-center text-xs text-muted">{t('deviceNote')}</p>
    </main>
  );
}
