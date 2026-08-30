import { TrendingUp, Search, PieChart, Wallet } from 'lucide-react'
import Link from 'next/link'

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center">
      <div className="flex items-center justify-center gap-3 mb-6">
        <TrendingUp className="w-10 h-10 text-[var(--accent)]" />
        <h1 className="text-3xl font-bold">Stock Gundam</h1>
      </div>
      <p className="text-[var(--text-secondary)] text-lg mb-12 max-w-xl mx-auto">
        AI 驅動的智慧股票分析平台，整合即時市場數據與多智能體分析引擎。
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/analyze"
          className="bg-[var(--bg-card)] rounded-xl p-6 border border-white/5 hover:border-[var(--accent)]/50 transition group text-left"
        >
          <Search className="w-8 h-8 text-[var(--accent)] mb-4" />
          <h2 className="text-lg font-semibold mb-2">AI 智能分析</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            輸入股票代號，啟動 9 個 AI 智能體進行市場、情緒、新聞、基本面多維度分析。
          </p>
        </Link>

        <Link
          href="/odd-lot"
          className="bg-[var(--bg-card)] rounded-xl p-6 border border-white/5 hover:border-[var(--accent)]/50 transition group text-left"
        >
          <PieChart className="w-8 h-8 text-[var(--accent-green)] mb-4" />
          <h2 className="text-lg font-semibold mb-2">台灣零股情報</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            查詢台灣股市零股交易行情、盤中即時報價與歷史成交資訊。
          </p>
        </Link>

        <Link
          href="/portfolio"
          className="bg-[var(--bg-card)] rounded-xl p-6 border border-white/5 hover:border-[var(--accent)]/50 transition group text-left"
        >
          <Wallet className="w-8 h-8 text-[var(--accent-green)] mb-4" />
          <h2 className="text-lg font-semibold mb-2">個人損益試算</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            輸入持有部位試算損益，套用巴菲特價值投資等法則取得 AI 買賣建議。
          </p>
        </Link>
      </div>
    </div>
  )
}
