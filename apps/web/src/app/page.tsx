import { Search, PieChart, Wallet, Activity, BarChart3, Bot, Newspaper } from 'lucide-react'
import Link from 'next/link'
import { getDict, getLocale } from '@/i18n/server'
import { localizePath } from '@/i18n/paths'
import { buildAlternates } from '@/i18n/metadata'
import { getMarketFocus } from '@stock/database'

export async function generateMetadata() {
  const dict = await getDict()
  const locale = await getLocale()
  return {
    title: dict.home.metaTitle,
    description: dict.home.metaDesc,
    alternates: buildAlternates(locale, '/'),
  }
}

function formatPubDate(s: string): string {
  const dt = new Date(s)
  if (Number.isNaN(dt.getTime())) return s
  return (
    dt.toLocaleDateString('zh-TW') +
    ' ' +
    dt.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
  )
}

export default async function Home() {
  const dict = await getDict()
  const locale = await getLocale()
  const quotes = dict.home.heroQuotes
  const q = quotes[Math.floor(Math.random() * quotes.length)]
  const main = locale === 'zh-TW' ? q.zh : locale === 'ja' ? q.ja : undefined
  const showEnglish = Boolean(main)
  const focus = await getMarketFocus(6)

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: 'Vestential',
        url: 'https://vestential.com',
        description: dict.home.metaDesc,
        inLanguage: ['zh-TW', 'en', 'ja'],
      },
      {
        '@type': 'Organization',
        name: 'Vestential',
        url: 'https://vestential.com',
        description: dict.home.metaDesc,
        slogan: 'Vestential = Vest + Essential',
      },
    ],
  }

  return (
    <div className="max-w-5xl mx-auto w-full px-4 py-8 md:py-10 text-center">
      <section aria-label={dict.home.heroTitle} className="mb-10">
        <h1 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)] mb-3">{dict.home.heroTitle}</h1>
        <p className="max-w-2xl mx-auto text-base text-[var(--text-secondary)] leading-relaxed mb-8">
          {dict.home.heroSubtitle}
        </p>
        <figure className="bg-[var(--bg-card)] rounded-xl px-6 py-4 border border-white/5 max-w-2xl mx-auto">
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
      </section>

      <section aria-label={dict.home.marketFocusTitle} className="mb-10 text-left">
        <div className="flex items-center gap-2 mb-1">
          <Newspaper className="w-4 h-4 text-[var(--accent)]" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{dict.home.marketFocusTitle}</h2>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-[var(--text-secondary)]">AI</span>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-4">{dict.home.marketFocusSubtitle}</p>
        {focus.length > 0 ? (
          <ul className="grid grid-cols-1 gap-3">
            {focus.map((item) => (
              <li key={item.id} className="bg-[var(--bg-card)] rounded-xl p-4 border border-white/5">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--text-primary)] font-medium leading-snug hover:text-[var(--accent)] transition"
                >
                  {item.title}
                </a>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)] mt-1.5">
                  {item.source && <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">{item.source}</span>}
                  {item.published_at && <span>{formatPubDate(item.published_at)}</span>}
                </div>
                {item.reason && (
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed mt-2 pt-2 border-t border-white/5">
                    {item.reason}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">{dict.home.marketFocusEmpty}</p>
        )}
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 text-left">
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

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    </div>
  )
}