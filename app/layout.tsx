import type { Metadata, Viewport } from 'next';
import './globals.css';
import { getLocale } from '@/lib/i18n';
import { dir } from '@/lib/i18n/dictionaries';
import { PwaRegister } from '@/components/pwa-register';

export const metadata: Metadata = {
  title: 'TaskNote Plus',
  description:
    'TaskNote Plus - one workspace for notes, tasks, projects, goals and calendar. Mobile-first, offline-capable, AI-optional.',
  applicationName: 'TaskNote Plus',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'TaskNote Plus', statusBarStyle: 'default' },
  icons: { icon: '/icon.svg', apple: '/icon-192.png' },
};

export const viewport: Viewport = {
  themeColor: '#3c60ee',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale} dir={dir(locale)} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('tn-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}`,
          }}
        />
      </head>
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
