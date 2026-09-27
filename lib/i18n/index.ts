import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, dictionaries, type Locale, type TranslationKey } from './dictionaries';

export const LOCALE_COOKIE = 'tn_locale';

export function translate(locale: Locale, key: TranslationKey): string {
  return dictionaries[locale][key];
}

export type Translator = (key: TranslationKey) => string;

export function makeTranslator(locale: Locale): Translator {
  return (key) => translate(locale, key);
}

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return value === 'en' || value === 'ar' ? value : DEFAULT_LOCALE;
}

export async function getTranslator(): Promise<{ locale: Locale; t: Translator }> {
  const locale = await getLocale();
  return { locale, t: makeTranslator(locale) };
}

export * from './dictionaries';
export { DEFAULT_LOCALE };
