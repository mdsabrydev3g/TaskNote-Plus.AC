import { requireSession } from '@/lib/auth/current';
import { getTranslator } from '@/lib/i18n';
import { dictionaries } from '@/lib/i18n/dictionaries';
import { BottomNav, Sidebar } from '@/components/shell/app-nav';
import { TopBar } from '@/components/shell/top-bar';
import { CommandPalette } from '@/components/command-palette';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const { locale } = await getTranslator();
  const dict = dictionaries[locale];

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar dict={dict} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar dict={dict} locale={locale} email={session.email} />
        <div className="flex items-center justify-end px-4 pt-3">
          <CommandPalette dict={dict} />
        </div>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-4 md:pb-10">{children}</main>
        <BottomNav dict={dict} />
      </div>
    </div>
  );
}
