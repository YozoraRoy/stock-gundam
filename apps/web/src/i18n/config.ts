export const locales = ['zh-TW', 'en', 'ja'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'zh-TW'

export const localeNames: Record<Locale, string> = {
  'zh-TW': '繁體中文',
  en: 'English',
  ja: '日本語',
}

const STORAGE_KEY = 'vestential_locale'
export const APP_LOCALE_COOKIE = 'vestential_locale'

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value)
}

export function detectLocale(lang?: string | null): Locale {
  const l = (lang || '').toLowerCase()
  if (l.startsWith('zh')) return 'zh-TW'
  if (l.startsWith('ja')) return 'ja'
  if (l.startsWith('en')) return 'en'
  return defaultLocale
}

export function getStoredLocale(): Locale | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return isLocale(raw) ? raw : null
  } catch {
    return null
  }
}

export function storeLocale(locale: Locale): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, locale)
    document.cookie = `${APP_LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`
  } catch {
    /* ignore */
  }
}
