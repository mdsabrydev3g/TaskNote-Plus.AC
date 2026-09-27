import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/current';

export default async function RootPage() {
  const session = await getSession();
  redirect(session ? '/app/home' : '/login');
}
