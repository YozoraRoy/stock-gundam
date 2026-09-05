import { locales, type Locale } from './config'

/** 剝除路徑開頭連續的語系前綴（含歷史疊加如 /ja/ja/en/...），回傳無前綴路徑。 */
function stripLocalePrefixes(path: string): string {
  const segments = path.split('/').filter(Boolean)
  let i = 0
  while (i < segments.length && (locales as readonly string[]).includes(segments[i])) i++
  const rest = segments.slice(i)
  return rest.length ? `/${rest.join('/')}` : '/'
}

/** 依當前語系產生帶前綴的內部路徑。zh-TW 為預設語系，不加前綴。 */
export function localizePath(locale: Locale, path: string): string {
  const bare = stripLocalePrefixes(path)
  if (locale === 'zh-TW') return bare
  if (bare === '/') return `/${locale}`
  return `/${locale}${bare.startsWith('/') ? bare : `/${bare}`}`
}
