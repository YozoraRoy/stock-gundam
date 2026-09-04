import type { Locale } from './config'

/** 依當前語系產生帶前綴的內部路徑。zh-TW 為預設語系，不加前綴。 */
export function localizePath(locale: Locale, path: string): string {
  if (locale === 'zh-TW') return path
  if (path === '/') return `/${locale}`
  return `/${locale}${path.startsWith('/') ? path : `/${path}`}`
}
