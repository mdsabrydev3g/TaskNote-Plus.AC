'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MOBILE_NAV, PRIMARY_NAV, type NavItem } from '@/lib/nav';
import type { Dict } from '@/lib/i18n/dictionaries';

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ dict }: { dict: Dict }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 border-e border-line bg-elevated p-4 md:block">
      <div className="mb-6 flex items-center gap-3 px-2">
        <span
          aria-hidden="true"
          className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 font-bold text-white"
        >
          ✓
        </span>
        <span className="text-sm font-semibold">{dict.appName}</span>
      </div>
      <nav aria-label={dict.commandPalette} className="flex flex-col gap-1">
        {PRIMARY_NAV.map((item) => (
          <NavLink key={item.href} item={item} dict={dict} active={isActive(pathname, item.href)} />
        ))}
      </nav>
      <div className="mt-6 border-t border-line pt-4">
        <NavLink
          item={{ href: '/app/settings', key: 'settings', icon: '⚙' }}
          dict={dict}
          active={isActive(pathname, '/app/settings')}
        />
      </div>
    </aside>
  );
}

function NavLink({ item, dict, active }: { item: NavItem; dict: Dict; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
        active ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-200' : 'text-muted hover:bg-line/40'
      }`}
    >
      <span aria-hidden="true" className="w-4 text-center">
        {item.icon}
      </span>
      <span>{dict[item.key]}</span>
    </Link>
  );
}

export function BottomNav({ dict }: { dict: Dict }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={dict.commandPalette}
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-elevated/95 backdrop-blur md:hidden"
    >
      {MOBILE_NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${
              active ? 'text-brand-600' : 'text-muted'
            }`}
          >
            <span aria-hidden="true" className="text-base leading-none">
              {item.icon}
            </span>
            {dict[item.key]}
          </Link>
        );
      })}
    </nav>
  );
}
