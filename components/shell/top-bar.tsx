'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { setLocaleAction, signOutAction } from '@/app/actions/auth';
import type { Dict } from '@/lib/i18n/dictionaries';

export function TopBar({ dict, locale, email }: { dict: Dict; locale: 'ar' | 'en'; email: string }) {
  const [pending, startTransition] = useTransition();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem('tn-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored === 'dark' || (!stored && prefersDark);
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    window.localStorage.setItem('tn-theme', next ? 'dark' : 'light');
  };

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur">
      <div className="min-w-0">
        <p className="truncate text-xs text-muted">
          {dict.signedInAs} <span className="font-medium text-ink">{email}</span>
        </p>
      </div>

      <div className="flex items-center gap-2">
        {/* One-click access to the password screen from every page. */}
        <Link
          href="/app/settings/security"
          className="btn-ghost px-3 py-1.5 text-xs"
          aria-label={dict.changePassword}
          title={dict.changePassword}
        >
          <span aria-hidden="true">🔑</span>
          <span className="hidden sm:inline">{dict.changePassword}</span>
        </Link>

        <button
          type="button"
          className="btn-ghost px-3 py-1.5 text-xs"
          onClick={toggleTheme}
          aria-label={dict.theme}
          aria-pressed={dark}
        >
          <span aria-hidden="true">{dark ? '☾' : '☀'}</span>
        </button>

        <button
          type="button"
          className="btn-ghost px-3 py-1.5 text-xs"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await setLocaleAction(locale === 'ar' ? 'en' : 'ar');
            })
          }
        >
          {locale === 'ar' ? 'EN' : 'عربي'}
        </button>

        <form action={signOutAction}>
          <button type="submit" className="btn-ghost px-3 py-1.5 text-xs">
            {dict.signOut}
          </button>
        </form>
      </div>
    </header>
  );
}
