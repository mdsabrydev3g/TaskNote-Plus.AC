import type { TranslationKey } from './i18n/dictionaries';

export type NavItem = {
  href: string;
  key: TranslationKey;
  icon: string;
};

export const PRIMARY_NAV: NavItem[] = [
  { href: '/app/home', key: 'home', icon: '◉' },
  { href: '/app/inbox', key: 'inbox', icon: '⇥' },
  { href: '/app/tasks', key: 'tasks', icon: '☑' },
  { href: '/app/projects', key: 'projects', icon: '▤' },
  { href: '/app/goals', key: 'goals', icon: '◎' },
  { href: '/app/notes', key: 'notes', icon: '✎' },
  { href: '/app/calendar', key: 'calendar', icon: '▦' },
  { href: '/app/search', key: 'search', icon: '⌕' },
];

export const MOBILE_NAV: NavItem[] = [
  { href: '/app/home', key: 'home', icon: '◉' },
  { href: '/app/inbox', key: 'inbox', icon: '⇥' },
  { href: '/app/tasks', key: 'tasks', icon: '☑' },
  { href: '/app/notes', key: 'notes', icon: '✎' },
  { href: '/app/settings', key: 'settings', icon: '⚙' },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: '/app/settings', key: 'settings', icon: '⚙' },
];
