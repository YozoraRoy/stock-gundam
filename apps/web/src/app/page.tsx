import { Search, PieChart, Wallet, Activity, BarChart3, Bot } from 'lucide-react'
import Link from 'next/link'
import { getDict, getLocale } from '@/i18n/server'
import { localizePath } from '@/i18n/paths'

export default async function Home() {
  const dict = await getDict()
  const locale = await getLocale()
  const quotes = dict.home.heroQuotes
  const q = quotes[Math.floor(Math.random() * quotes.length)]
  const main = locale === 'zh-TW' ? q.zh : locale === 'ja' ? q.ja : undefined
  const showEnglish = Boolean(main)
  return (
    <div className="max-w-5xl mx-auto w-full px-4 py-8 md:py-10 text-center">
      <figure className="bg-[var(--bg-card)] rounded-xl px-6 py-4 border border-white/5 max-w-2xl mx-auto mb-10">
        <blockquote className="text-[var(--text-primary)] text-base md:text-lg leading-relaxed mb-2">
          <span className="text-[var(--accent)] text-xl leading-none mr-1 align-top" aria-hidden="true">{'\u201C'}</span>
          {main ?? q.en}
          <span className="text-[var(--accent)] text-xl leading-none ml-1 align-bottom" aria-hidden="true">{'\u201D'}</span>
        </blockquote>
        {showEnglish && (
          <p className="text-sm italic text-[var(--text-secondary)] mb-2">
            {q.en}
          </p>
        )}
        <figcaption className="text-sm text-[var(--text-secondary)] text-right">
          — {q.author}
        </figcaption>
      </figure>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        <Link
          href={localizePath(locale, '/odd-lot')}
          className="bg-[var(--bg-card)] rounded-xl p-5 border border-white/5 hover:border-[var(--accent)]/50 transition group text-left flex flex-col"
        >
          <div className="flex items-start justify-between mb-3">
            <PieChart className="w-7 h-7 text-[var(--accent-green)]" />
          </div>
          <h2 className="text-lg font-semibold mb-1.5">{dict.home.oddLotTitle}</h2>
          <p className="text-base text-[var(--text-secondary)] flex-1">
            {dict.home.oddLotDesc}
          </p>
        </Link>

        <Link
          href={localizePath(locale, '/backtest')}
          className="bg-[var(--bg-card)] rounded-xl p-5 border border-white/5 hover:border-[var(--accent)]/50 transition group text-left flex flex-col"
        >
          <div className="flex items-start justify-between mb-3">
            <Activity className="w-7 h-7 text-[var(--accent-green)]" />
          </div>
          <h2 className="text-lg font-semibold mb-1.5">{dict.home.backtestTitle}</h2>
          <p className="text-base text-[var(--text-secondary)] flex-1">
            {dict.home.backtestDesc}
          </p>
        </Link>

        <Link
          href={localizePath(locale, '/portfolio')}
          className="bg-[var(--bg-card)] rounded-xl p-5 border border-white/5 hover:border-[var(--accent)]/50 transition group text-left flex flex-col"
        >
          <div className="flex items-start justify-between mb-3">
            <Wallet className="w-7 h-7 text-[var(--accent-green)]" />
          </div>
          <h2 className="text-lg font-semibold mb-1.5">{dict.home.portfolioTitle}</h2>
          <p className="text-base text-[var(--text-secondary)] flex-1">
            {dict.home.portfolioDesc}
          </p>
        </Link>

        <Link
          href={localizePath(locale, '/analyze')}
          className="bg-[var(--bg-card)] rounded-xl p-5 border border-white/5 hover:border-[var(--accent)]/50 transition group text-left flex flex-col"
        >
          <div className="flex items-start justify-between mb-3">
            <Search className="w-7 h-7 text-[var(--accent)]" />
          </div>
          <h2 className="text-lg font-semibold mb-1.5">{dict.home.aiAnalyzeTitle}</h2>
          <p className="text-base text-[var(--text-secondary)] flex-1">
            {dict.home.aiAnalyzeDesc}
          </p>
        </Link>

        <div className="relative bg-[var(--bg-card)] rounded-xl p-5 border border-white/5 opacity-70 select-none flex flex-col">
          <div className="flex items-start justify-between mb-3">
            <BarChart3 className="w-7 h-7 text-[var(--accent)]" />
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[var(--text-secondary)]">
              {dict.home.inDevelopment}
            </span>
          </div>
          <h2 className="text-lg font-semibold mb-1.5">{dict.home.optionsTitle}</h2>
          <p className="text-base text-[var(--text-secondary)] flex-1">
            {dict.home.optionsDesc}
          </p>
        </div>

        <div className="relative bg-[var(--bg-card)] rounded-xl p-5 border border-white/5 opacity-70 select-none flex flex-col">
          <div className="flex items-start justify-between mb-3">
            <Bot className="w-7 h-7 text-[var(--accent-green)]" />
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[var(--text-secondary)]">
              {dict.home.inDevelopment}
            </span>
          </div>
          <h2 className="text-lg font-semibold mb-1.5">{dict.home.agentTitle}</h2>
          <p className="text-base text-[var(--text-secondary)] flex-1">
            {dict.home.agentDesc}
          </p>
        </div>
      </div>
    </div>
  )
}