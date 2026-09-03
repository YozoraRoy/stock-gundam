'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  defaultLocale,
  detectLocale,
  getStoredLocale,
  isLocale,
  storeLocale,
  type Locale,
} from './config'
import { dictionaries, type Dict } from './dictionaries'

interface I18nContextValue {
  locale: Locale
  dict: Dict
  setLocale: (locale: Locale) => void
}

const I18nContext = createContext<I18nContextValue>({
  locale: defaultLocale,
  dict: dictionaries[defaultLocale],
  setLocale: () => {},
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale)

  useEffect(() => {
    const stored = getStoredLocale()
    if (stored) {
      setLocaleState(stored)
      return
    }
    setLocaleState(detectLocale(typeof navigator !== 'undefined' ? navigator.language : ''))
  }, [])

  const setLocale = useCallback((next: Locale) => {
    if (!isLocale(next)) return
    setLocaleState(next)
    storeLocale(next)
    if (typeof document !== 'undefined') {
      document.documentElement.lang = next
    }
  }, [])

  const dict = dictionaries[locale]

  return (
    <I18nContext.Provider value={{ locale, dict, setLocale }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext)
}
