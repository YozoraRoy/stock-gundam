import { cookies, headers } from 'next/headers'
import { APP_LOCALE_COOKIE, defaultLocale, isLocale, type Locale } from './config'
import { dictionaries, type Dict } from './dictionaries'

/** middleware 設定的 request header，表示目前請求以哪個語系呈現（優先於 cookie）。 */
const LOCALE_HEADER = 'x-locale'

export async function getLocale(): Promise<Locale> {
  // middleware 優先：以 x-locale header（來自分流路徑或瀏覽器偵測）為準
  try {
    const h = await headers()
    const viaHeader = h.get(LOCALE_HEADER)
    if (isLocale(viaHeader)) return viaHeader as Locale
  } catch {
    /* 無 request header 時忽略 */
  }
  const store = await cookies()
  const raw = store.get(APP_LOCALE_COOKIE)?.value
  if (isLocale(raw)) return raw as Locale
  return defaultLocale
}

export async function getDict(): Promise<Dict> {
  const locale = await getLocale()
  return dictionaries[locale]
}
