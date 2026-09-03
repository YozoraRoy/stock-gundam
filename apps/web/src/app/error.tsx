'use client'

import { useEffect } from 'react'
import { useI18n } from '@/i18n/LanguageProvider'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { dict } = useI18n()
  const ui = dict.errorPage
  useEffect(() => {
    console.error('[App Error Boundary]:', error)
  }, [error])

  return (
    <div className="w-full min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-[var(--bg-card)] border border-rose-500/30 rounded-2xl p-8 max-w-md space-y-4 shadow-xl">
        <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto text-xl font-bold">
          !
        </div>
        <h2 className="text-xl font-bold text-white">{ui.title}</h2>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          {error.message || ui.body}
        </p>
        <button
          onClick={() => reset()}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 transition shadow-lg shadow-[var(--accent)]/20 cursor-pointer"
        >
          {ui.reload}
        </button>
      </div>
    </div>
  )
}
