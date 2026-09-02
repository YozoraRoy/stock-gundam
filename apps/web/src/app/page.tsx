import { Search, PieChart, Wallet, Activity, BarChart3, Bot } from 'lucide-react'
import Link from 'next/link'

export default function Home() {
  return (
    <div className="max-w-5xl mx-auto w-full px-4 py-8 md:py-10 text-center">
      <p className="text-[var(--text-secondary)] text-base md:text-lg mb-6 md:mb-10 max-w-xl mx-auto">
        AI 驅動的智慧股票分析平台，整合即時市場數據與多智能體分析引擎。
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        <Link
          href="/analyze"
          className="bg-[var(--bg-card)] rounded-xl p-5 border border-white/5 hover:border-[var(--accent)]/50 transition group text-left flex flex-col"
        >
          <div className="flex items-start justify-between mb-3">
            <Search className="w-7 h-7 text-[var(--accent)]" />
          </div>
          <h2 className="text-lg font-semibold mb-1.5">AI 智能分析</h2>
          <p className="text-sm text-[var(--text-secondary)] flex-1">
            輸入股票代號，啟動 8 個 AI 智能體進行市場、情緒、新聞、基本面多維度分析。
          </p>
        </Link>

        <Link
          href="/odd-lot"
          className="bg-[var(--bg-card)] rounded-xl p-5 border border-white/5 hover:border-[var(--accent)]/50 transition group text-left flex flex-col"
        >
          <div className="flex items-start justify-between mb-3">
            <PieChart className="w-7 h-7 text-[var(--accent-green)]" />
          </div>
          <h2 className="text-lg font-semibold mb-1.5">台灣零股情報</h2>
          <p className="text-sm text-[var(--text-secondary)] flex-1">
            查詢台灣股市零股交易行情、盤中即時報價與歷史成交資訊。
          </p>
        </Link>

        <Link
          href="/portfolio"
          className="bg-[var(--bg-card)] rounded-xl p-5 border border-white/5 hover:border-[var(--accent)]/50 transition group text-left flex flex-col"
        >
          <div className="flex items-start justify-between mb-3">
            <Wallet className="w-7 h-7 text-[var(--accent-green)]" />
          </div>
          <h2 className="text-lg font-semibold mb-1.5">個人損益試算</h2>
          <p className="text-sm text-[var(--text-secondary)] flex-1">
            輸入持有部位試算損益，套用巴菲特價值投資等法則取得 AI 買賣建議。
          </p>
        </Link>

        <Link
          href="/backtest"
          className="bg-[var(--bg-card)] rounded-xl p-5 border border-white/5 hover:border-[var(--accent)]/50 transition group text-left flex flex-col"
        >
          <div className="flex items-start justify-between mb-3">
            <Activity className="w-7 h-7 text-[var(--accent-green)]" />
          </div>
          <h2 className="text-lg font-semibold mb-1.5">週期進場模型預估</h2>
          <p className="text-sm text-[var(--text-secondary)] flex-1">
            以季線乖離率歷史回測，找出最佳進場時機與勝率。
          </p>
        </Link>

        <div className="relative bg-[var(--bg-card)] rounded-xl p-5 border border-white/5 opacity-70 select-none flex flex-col">
          <div className="flex items-start justify-between mb-3">
            <BarChart3 className="w-7 h-7 text-[var(--accent)]" />
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[var(--text-secondary)]">
              開發中
            </span>
          </div>
          <h2 className="text-lg font-semibold mb-1.5">期權策略模擬</h2>
          <p className="text-sm text-[var(--text-secondary)] flex-1">
            設計選擇權組合策略，模擬不同市場情境下的損益與風險敞口。
          </p>
        </div>

        <div className="relative bg-[var(--bg-card)] rounded-xl p-5 border border-white/5 opacity-70 select-none flex flex-col">
          <div className="flex items-start justify-between mb-3">
            <Bot className="w-7 h-7 text-[var(--accent-green)]" />
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[var(--text-secondary)]">
              開發中
            </span>
          </div>
          <h2 className="text-lg font-semibold mb-1.5">AI Agent 交易觀測</h2>
          <p className="text-sm text-[var(--text-secondary)] flex-1">
            即時觀察 AI Agent 的交易決策過程、持倉變動與績效回測表現。
          </p>
        </div>
      </div>
    </div>
  )
}
