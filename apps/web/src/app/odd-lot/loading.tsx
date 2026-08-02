import { Gift, TrendingUp } from 'lucide-react'

export default function OddLotLoading() {
  return (
    <div className="w-full min-h-screen px-4 md:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <TrendingUp className="w-6 h-6 text-[var(--accent)]" />
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">台灣零股行情與股東會紀念品情報</h1>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">整合 TWSE 盤後零股交易數據與股東會紀念品資訊</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-[var(--bg-card)] border border-white/10 px-4 py-2 rounded-xl flex items-center gap-2 text-xs">
            <Gift className="w-4 h-4 text-[var(--accent-green)] animate-pulse" />
            <span>內建紀念品自動分類與篩選</span>
          </div>
        </div>
      </div>

      <div className="bg-[var(--bg-card)] border border-white/10 rounded-2xl p-10 flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 border-2 border-white/10 border-t-[var(--accent)] rounded-full animate-spin" />
          <Gift className="w-4 h-4 text-[var(--accent)] absolute inset-0 m-auto" />
        </div>
        <div className="text-center space-y-1.5">
          <p className="text-sm font-medium text-white">載入零股行情與紀念品資料中...</p>
          <p className="text-xs text-[var(--text-secondary)]">
            首次載入需從 TWSE 資料庫與即時行情更新，約需數秒，請稍候
          </p>
        </div>
      </div>

      <div className="bg-[var(--bg-card)] border border-white/5 rounded-2xl p-4 md:p-6 space-y-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-10 rounded-xl bg-white/5" />
          <div className="h-10 w-28 rounded-xl bg-white/5" />
          <div className="h-10 w-28 rounded-xl bg-white/5" />
        </div>
        <div className="h-8 w-48 rounded-lg bg-white/5" />
        <div className="h-72 rounded-2xl bg-white/[0.03] border border-white/5" />
      </div>
    </div>
  )
}
