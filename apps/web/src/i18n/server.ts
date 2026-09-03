import { cookies } from 'next/headers'
import { APP_LOCALE_COOKIE, defaultLocale, isLocale, type Locale } from './config'
import { dictionaries, type Dict } from './dictionaries'

export async function getLocale(): Promise<Locale> {
  const store = await cookies()
  const raw = store.get(APP_LOCALE_COOKIE)?.value
  return isLocale(raw) ? (raw as Locale) : defaultLocale
}

export async function getDict(): Promise<Dict> {
  const locale = await getLocale()
  return dictionaries[locale]
}
