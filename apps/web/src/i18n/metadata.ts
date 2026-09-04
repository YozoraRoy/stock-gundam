import { locales, type Locale } from './config'

const BASE_URL = 'https://vestential.com'

export function localizedPath(locale: Locale, routePath: string): string {
  if (locale === 'zh-TW') return routePath === '/' ? '/' : routePath
  return routePath === '/' ? `/${locale}` : `/${locale}${routePath}`
}

export function buildAlternates(locale: Locale, routePath: string) {
  const languages: Record<string, string> = {}
  for (const l of locales) {
    languages[l] = `${BASE_URL}${localizedPath(l, routePath)}`
  }
  languages['x-default'] = `${BASE_URL}${localizedPath('zh-TW', routePath)}`
  return {
    canonical: `${BASE_URL}${localizedPath(locale, routePath)}`,
    languages,
  }
}
