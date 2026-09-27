import { getTranslator } from '@/lib/i18n';
import { dictionaries } from '@/lib/i18n/dictionaries';
import { AuthForm } from '@/components/auth-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const { locale } = await getTranslator();
  return <AuthForm mode="signin" dict={dictionaries[locale]} />;
}
