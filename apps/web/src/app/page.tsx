import { Search, PieChart, Wallet, Activity, BarChart3, Bot } from 'lucide-react'
import Link from 'next/link'
import { getDict } from '@/i18n/server'

export default async function Home() {
  const dict = await getDict()
  return (
    <div className="max-w-5xl mx-auto w-full px-4 py-8 md:py-10 text-center">
      <p className="text-[var(--text-secondary)] text-base md:text-lg mb-6 md:mb-10 max-w-xl mx-auto">
        {dict.home.hero}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        <Link
          href="/analyze"
          className="bg-[var(--bg-card)] rounded-xl p-5 border border-white/5 hover:border-[var(--accent)]/50 transition group text-left flex flex-col"
        >
          <div className="flex items-start justify-between mb-3">
            <Search className="w-7 h-7 text-[var(--accent)]" />
          </div>
          <h2 className="text-lg font-semibold mb-1.5">{dict.home.aiAnalyzeTitle}</h2>
          <p className="text-sm text-[var(--text-secondary)] flex-1">
            {dict.home.aiAnalyzeDesc}
          </p>
        </Link>

        <Link
          href="/odd-lot"
          className="bg-[var(--bg-card)] rounded-xl p-5 border border-white/5 hover:border-[var(--accent)]/50 transition group text-left flex flex-col"
        >
          <div className="flex items-start justify-between mb-3">
            <PieChart className="w-7 h-7 text-[var(--accent-green)]" />
          </div>
          <h2 className="text-lg font-semibold mb-1.5">{dict.home.oddLotTitle}</h2>
          <p className="text-sm text-[var(--text-secondary)] flex-1">
            {dict.home.oddLotDesc}
          </p>
        </Link>

        <Link
          href="/portfolio"
          className="bg-[var(--bg-card)] rounded-xl p-5 border border-white/5 hover:border-[var(--accent)]/50 transition group text-left flex flex-col"
        >
          <div className="flex items-start justify-between mb-3">
            <Wallet className="w-7 h-7 text-[var(--accent-green)]" />
          </div>
          <h2 className="text-lg font-semibold mb-1.5">{dict.home.portfolioTitle}</h2>
          <p className="text-sm text-[var(--text-secondary)] flex-1">
            {dict.home.portfolioDesc}
          </p>
        </Link>

        <Link
          href="/backtest"
          className="bg-[var(--bg-card)] rounded-xl p-5 border border-white/5 hover:border-[var(--accent)]/50 transition group text-left flex flex-col"
        >
          <div className="flex items-start justify-between mb-3">
            <Activity className="w-7 h-7 text-[var(--accent-green)]" />
          </div>
          <h2 className="text-lg font-semibold mb-1.5">{dict.home.backtestTitle}</h2>
          <p className="text-sm text-[var(--text-secondary)] flex-1">
            {dict.home.backtestDesc}
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
          <p className="text-sm text-[var(--text-secondary)] flex-1">
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
          <p className="text-sm text-[var(--text-secondary)] flex-1">
            {dict.home.agentDesc}
          </p>
        </div>
      </div>
    </div>
  )
}