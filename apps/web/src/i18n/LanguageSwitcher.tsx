'use client'

import { Globe, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { locales, localeNames, type Locale } from './config'
import { useI18n } from './LanguageProvider'

/** 這些頁面由 server 端 `getDict()` 渲染主體內容；在這些頁面上切換語系需整頁重整才能反映。 */
const SERVER_RENDERED_PAGES: readonly string[] = ['/', '/about', '/terms', '/privacy', '/odd-lot']

export function LanguageSwitcher() {
  const { locale, setLocale, dict } = useI18n()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const select = (next: Locale) => {
    setLocale(next)
    setOpen(false)
    if (SERVER_RENDERED_PAGES.includes(pathname ?? '')) {
      window.location.reload()
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-1 px-2.5 py-2 text-sm rounded-lg transition hover:bg-white/5"
        aria-label={dict.switcher.label}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Globe className="w-4.5 h-4.5 text-[var(--text-secondary)]" />
        <span className="text-xs text-[var(--text-secondary)]">{localeNames[locale]}</span>
        <ChevronDown className="w-3 h-3 text-[var(--text-secondary)]" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-40 bg-[var(--bg-card)] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
          {locales.map((item) => (
            <button
              key={item}
              onClick={() => select(item)}
              className={`w-full flex items-center px-4 py-2.5 text-sm transition ${
                item === locale
                  ? 'text-[var(--text-primary)] bg-white/10'
                  : 'text-[var(--text-secondary)] hover:bg-white/5'
              }`}
            >
              {localeNames[item]}
              {item === locale && <span className="ml-auto text-[var(--accent)]">•</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}