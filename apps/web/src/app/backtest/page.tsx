'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
} from 'recharts'
import { Search as SearchIcon, TrendingDown, Target, Repeat, Clock, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, ArrowUpDown, ArrowUp, ArrowDown, HelpCircle, Activity, ListOrdered, X } from 'lucide-react'

interface SeriesPoint {
  date: number
  close: number
  ma60: number | null
  bias: number | null
  trigger: boolean
}

interface Trade {
  entryDate: number
  entryPrice: number
  outcome: 'win' | 'loss' | 'neutral'
  daysToTarget: number | null
}

interface ThresholdRow {
  threshold: number
  totalTrades: number
  winRate: number | null
  trades: Trade[]
}

type SortKey = 'threshold' | 'totalTrades' | 'winRate'

interface Suggestion {
  symbol: string
  name: string
  market: string
}

interface BacktestResponse {
  bestThreshold: number
  totalTrades: number
  winRate: number | null
  avgDaysToTarget: number | null
  wins: number
  losses: number
  neutral: number
  belowTarget: boolean
  allThresholds: ThresholdRow[]
  series: SeriesPoint[]
  usage: { startDate: number; endDate: number; dataPoints: number; entryThresholdPct: number }
}

interface LiveBias {
  symbol: string
  ma60: number
  latestClose: number
  latestBias: number | null
  livePrice: number | null
  livePriceBias: number | null
  asOf: number
}

interface TopVolumeItem {
  rank: number
  symbol: string
  name: string
  volume: number
  value?: number
  price?: number
}

type TopVolumeRange = 'day' | 'week' | 'month' | 'quarter'

function fmtPct(v: number | null): string {
  if (v == null) return '—'
  return `${(v * 100).toFixed(1)}%`
}

function fmtDays(v: number | null): string {
  if (v == null) return '—'
  return `${v.toFixed(1)} 天`
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function fmtPriceRange(trades: Trade[]): string {
  if (!trades || trades.length === 0) return '—'
  const prices = trades.map((t) => t.entryPrice)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  if (min === max) return min.toFixed(2)
  return `${min.toFixed(2)} ~ ${max.toFixed(2)}`
}

/** 成交量格式化：億/萬。 */
function fmtVolume(v: number): string {
  if (v >= 1e8) return `${(v / 1e8).toFixed(2)} 億`
  if (v >= 1e4) return `${(v / 1e4).toFixed(1)} 萬`
  return `${Math.round(v)}`
}

/** 送出一筆功能使用事件（伺服器會依登入狀態歸屬帳號）。keepalive 避免遺失、不阻擋。 */
function trackEvent(event: 'page_view' | 'backtest_run', symbol?: string) {
  try {
    fetch('/api/backtest/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, symbol: symbol ?? null }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* ignore */
  }
}

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ArrowUpDown className="w-3.5 h-3.5 inline ml-1 text-[var(--text-secondary)] opacity-60" />
  return dir === 'asc' ? (
    <ArrowUp className="w-3.5 h-3.5 inline ml-1 text-[var(--accent)]" />
  ) : (
    <ArrowDown className="w-3.5 h-3.5 inline ml-1 text-[var(--accent)]" />
  )
}

function OutcomeBadge({ outcome }: { outcome: Trade['outcome'] }) {
  if (outcome === 'win') {
    return <span className="text-[var(--accent-green)] font-medium">勝</span>
  }
  if (outcome === 'loss') return <span className="text-[var(--accent-red)] font-medium">敗</span>
  return <span className="text-[var(--text-secondary)]">平</span>
}

/** 欄位說明的「？」圖示，滑鼠懸停顯示 tooltip（可含公式）。align 控制 tooltip 相對圖示的水平對齊，靠邊欄位請用 'left' 以避免被裁切。 */
function HelpCell({ text, align = 'center' }: { text: string; align?: 'left' | 'center' | 'right' }) {
  const alignCls = align === 'left' ? 'left-0' : align === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2'
  return (
    <span className="relative inline-flex items-center ml-1.5 group/help">
      <HelpCircle className="w-3.5 h-3.5 text-[var(--text-secondary)] cursor-help" />
      <span
        className={`pointer-events-none absolute top-full ${alignCls} mt-1 z-30 w-64 hidden group-hover/help:block p-3 rounded-lg bg-[var(--bg-card)] border border-white/10 shadow-xl text-[11px] leading-relaxed text-[var(--text-primary)] font-normal text-left`}
      >
        {text}
      </span>
    </span>
  )
}

/** 可排序的表格欄位標題，含排序箭頭與說明 tooltip。 */
function HeaderCell({
  label,
  sortable,
  active,
  dir,
  onSort,
  help,
  helpAlign,
}: {
  label: string
  sortable?: boolean
  active?: boolean
  dir?: 'asc' | 'desc'
  onSort?: () => void
  help: string
  helpAlign?: 'left' | 'center' | 'right'
}) {
  const base = 'px-4 py-2 text-left ' + (sortable ? 'cursor-pointer select-none hover:text-[var(--text-primary)]' : '')
  return (
    <th className={base} onClick={sortable ? onSort : undefined}>
      <span className="inline-flex items-center">
        {label}
        {sortable && active !== undefined && dir && <SortIcon active={active} dir={dir} />}
        <HelpCell text={help} align={helpAlign} />
      </span>
    </th>
  )
}

const COLUMN_HELP: Record<string, string> = {
  threshold:
    '訊號觸發門檻（乖離率）。當收盤價低於 60 日均線的乖離率 ≤ 此閾值時，於次一交易日進場。公式：乖離率 = (收盤價 − MA60) / MA60 × 100%。負值越大代表跌幅越深才進場。',
  totalTrades:
    '在此乖離率閾值下，過去所選年數內實際觸發並進場的交易總數。交易採非重疊判定：進場後鎖倉至該筆結束才可再有下一筆。',
  winRate:
    '勝場佔已分出勝負場次的比例，平手不計入。公式：勝率 = 勝場數 / (勝場數 + 敗場數) × 100%。',
  range:
    '該閾值下所有交易的進場價最低至最高區間。進場價為訊號確認後次一交易日的開盤價。',
}

export default function BacktestPage() {
  const [symbol, setSymbol] = useState('')
  const [holdingDays, setHoldingDays] = useState('40')
  const [targetPct, setTargetPct] = useState('8')
  const [stopPct, setStopPct] = useState('5')
  const [years, setYears] = useState('5')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BacktestResponse | null>(null)
  const [expandedThreshold, setExpandedThreshold] = useState<number | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('threshold')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [searching, setSearching] = useState(false)
  const [liveBias, setLiveBias] = useState<LiveBias | null>(null)
  const [showTop, setShowTop] = useState(false)
  const [topRange, setTopRange] = useState<TopVolumeRange>('day')
  const [topList, setTopList] = useState<TopVolumeItem[]>([])
  const [topLoading, setTopLoading] = useState(false)
  const [topError, setTopError] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  // 非純數字（可能是中文名稱）時，debounce 打 /api/backtest/search 模糊搜尋台股
  useEffect(() => {
    const q = symbol.trim()
    const pureTwCode = /^\d{4,6}$/.test(q)
    if (!q || pureTwCode) {
      setSuggestions([])
      setShowDropdown(false)
      setSearching(false)
      return
    }
    setSearching(true)
    setShowDropdown(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/backtest/search?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setSuggestions(data.results ?? [])
      } catch {
        setSuggestions([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [symbol])

  // 點選下拉選項 → 填入代號並自動回測
  const pickStock = (s: Suggestion) => {
    setSymbol(s.symbol)
    setShowDropdown(false)
    runFromSymbol(s.symbol)
  }

  // 點擊外部關閉下拉
  useEffect(() => {
    const onClick = (ev: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(ev.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // 造訪回測頁記錄（僅 mount 一次，避免 HMR/重渲染重複計）
  useEffect(() => {
    trackEvent('page_view')
  }, [])

  const runFromSymbol = async (sym: string) => {
    setLoading(true)
    setError(null)
    setResult(null)
    setLiveBias(null)
    setExpandedThreshold(null)
    trackEvent('backtest_run', sym)
    try {
      const qs = new URLSearchParams({
        symbol: sym,
        holdingDays: holdingDays || '40',
        target: targetPct || '8',
        stop: stopPct || '5',
        years: years || '5',
      })
      const res = await fetch(`/api/backtest?${qs.toString()}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '回測失敗')
        return
      }
      setResult(data)
      try {
        const lb = await fetch(`/api/backtest/live-bias?symbol=${encodeURIComponent(sym)}`)
        if (lb.ok) setLiveBias(await lb.json())
      } catch (_) {}
    } catch {
      setError('網路錯誤，請稍後再試')
    } finally {
      setLoading(false)
    }
  }

  const run = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const sym = symbol.trim()
    if (!sym) return
    await runFromSymbol(sym)
  }

  // 抓取「成交量 Top 10」清單（依所選範圍）。
  const loadTop = async (range: TopVolumeRange) => {
    setTopRange(range)
    setTopLoading(true)
    setTopError(null)
    try {
      const res = await fetch(`/api/backtest/top-volume?range=${range}`)
      const data = await res.json()
      if (!res.ok) {
        setTopError(data.error ?? '取得排行榜失敗')
        setTopList([])
        return
      }
      setTopList(data.results ?? [])
    } catch {
      setTopError('網路錯誤，請稍後再試')
      setTopList([])
    } finally {
      setTopLoading(false)
    }
  }

  const openTop = () => {
    setShowTop(true)
    setTopList([])
    setTopError(null)
    void loadTop('day')
  }

  // 點選排行榜中的股票 → 填入代號、關閉 modal、自動開始回測。
  const pickTopStock = (item: TopVolumeItem) => {
    setSymbol(item.symbol)
    setShowTop(false)
    void runFromSymbol(item.symbol)
  }

  const triggerPoints = (result?.series ?? []).filter((p) => p.trigger)
  const chartData = (result?.series ?? []).map((p) => ({
    date: p.date,
    close: p.close,
    ma60: p.ma60 ?? undefined,
  }))

  // 目前（昨收）乖離率 vs 最佳閾值：進場須乖離 ≤ 閾值，即收盤價 ≤ MA60 × (1 + 閾值/100)。
  const currentBias = liveBias?.latestBias ?? null
  const bestThreshold = result?.bestThreshold ?? null
  const targetClosePrice = bestThreshold != null && liveBias?.ma60 ? liveBias.ma60 * (1 + bestThreshold / 100) : null
  const distanceToTargetPct =
    currentBias != null && bestThreshold != null ? (currentBias - bestThreshold / 100) * 100 : null
  // 目前乖離已觸發的最佳閾值（乖離 ≤ 閾值即會觸發進場）
  const currentTriggerThreshold: number | null = (() => {
    if (currentBias == null || !result?.bestThreshold) return null
    if (currentBias <= result.bestThreshold / 100) return result.bestThreshold
    // 否則找最近一個已達成的較淺閾值
    const ts = (result.allThresholds ?? []).map((t) => t.threshold).sort((a, b) => b - a)
    for (const t of ts) if (currentBias <= t) return t
    return null
  })()

  const sortedRows = (result?.allThresholds ? [...result.allThresholds] : [])
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortKey === 'threshold') return (a.threshold - b.threshold) * dir
      if (sortKey === 'totalTrades') return (a.totalTrades - b.totalTrades) * dir
      const aw = a.winRate ?? -1
      const bw = b.winRate ?? -1
      return (aw - bw) * dir
    })

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'threshold' ? 'asc' : 'desc')
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-2">
        <Target className="w-7 h-7 text-[var(--accent)]" />
        <h1 className="text-2xl font-bold">週期進場模型預估</h1>
      </div>
      <p className="text-[var(--text-secondary)] mb-8">
        台股季線乖離回測：訊號收盤確認、次一交易日進場，{holdingDays || 40} 日內先 +{targetPct || 8}% 為勝、先 −{stopPct || 5}% 為敗。使用近 {years || 5} 年歷史資料。
      </p>

      <form onSubmit={run} className="mb-8 space-y-3 max-w-2xl">
        <div className="grid grid-cols-4 gap-2">
          <label className="block flex-1">
            <span className="block text-xs text-[var(--text-secondary)] mb-1">近 X 年</span>
            <input
              type="number"
              min={1}
              max={15}
              value={years}
              onChange={(e) => setYears(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-white/10 focus:border-[var(--accent)] outline-none text-sm"
            />
          </label>
          <label className="block flex-1">
            <span className="block text-xs text-[var(--text-secondary)] mb-1">持有天數</span>
            <input
              type="number"
              min={1}
              max={252}
              value={holdingDays}
              onChange={(e) => setHoldingDays(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-white/10 focus:border-[var(--accent)] outline-none text-sm"
            />
          </label>
          <label className="block flex-1">
            <span className="block text-xs text-[var(--text-secondary)] mb-1">目標獲利 %
              <HelpCell text={'這是「鎖定獲利」目標，不是停損。買入後若價格漲到「進場價 × (1 + 8%)」（例如進場 10 萬 → 漲到約 108,000），就觸發 +8% 賣出獲利。若先跌破「進場價 × (1 − 停損%)」(預設 −5%) 則觸發停損出場；價格沒到 +8% 也沒跌破停損，則持有滿「持有天數」後出場。'} />
            </span>
            <input
              type="number"
              min={1}
              max={100}
              value={targetPct}
              onChange={(e) => setTargetPct(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-white/10 focus:border-[var(--accent)] outline-none text-sm"
            />
          </label>
          <label className="block flex-1">
            <span className="block text-xs text-[var(--text-secondary)] mb-1">停損 %</span>
            <input
              type="number"
              min={1}
              max={100}
              value={stopPct}
              onChange={(e) => setStopPct(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-white/10 focus:border-[var(--accent)] outline-none text-sm"
            />
          </label>
        </div>

        <div className="flex items-center gap-2 max-w-md">
          <div className="relative flex-1" ref={dropdownRef}>
            <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              onFocus={() => {
                const q = symbol.trim()
                if (q && !/^\d{4,6}$/.test(q) && suggestions.length) setShowDropdown(true)
              }}
              placeholder="輸入台股代號或名稱，如 2330 / 台積電"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-white/10 focus:border-[var(--accent)] outline-none text-sm"
            />
            {(showDropdown || searching) && (
              <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-lg bg-[var(--bg-card)] border border-white/10 shadow-xl overflow-hidden">
                {searching ? (
                  <div className="px-3 py-2.5 text-xs text-[var(--text-secondary)] flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> 搜尋中...
                  </div>
                ) : suggestions.length > 0 ? (
                  suggestions.map((s, i) => (
                    <button
                      key={`${s.symbol}-${i}`}
                      type="button"
                      onClick={() => pickStock(s)}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-white/5 transition flex items-center gap-2"
                    >
                      <span className="font-mono text-[var(--accent)] w-20 shrink-0">{s.symbol}</span>
                      <span className="text-[var(--text-primary)] truncate">{s.name}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2.5 text-xs text-[var(--text-secondary)]">查無相符股票</div>
                )}
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-medium text-sm hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
            {loading ? '回測中...' : '開始回測'}
          </button>
          <button
            type="button"
            onClick={openTop}
            className="px-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-white/10 text-sm font-medium text-[var(--text-primary)] hover:bg-white/5 transition flex items-center gap-2 shrink-0"
          >
            <ListOrdered className="w-4 h-4 text-[var(--accent)]" />
            Top 10 成交量
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="p-10 text-center text-[var(--text-secondary)]">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3" />
          抓取 10 年歷史資料並執行參數尋優...
        </div>
      )}

      {result && (
        <div className="space-y-6">
          {result.belowTarget && (
            <div className="flex items-center gap-2 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              無任何進場閾值達到 75% 勝率目標，以下為歷史勝率最高的結果，僅供參考。
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-white/5">
              <div className="flex items-center gap-2 text-[var(--text-secondary)] text-xs mb-2">
                <TrendingDown className="w-3.5 h-3.5" /> 最佳進場乖離率
              </div>
              <div className="text-2xl font-bold text-[var(--accent)]">{fmtPct(result.bestThreshold / 100)}</div>
            </div>
            <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-white/5">
              <div className="flex items-center gap-2 text-[var(--text-secondary)] text-xs mb-2">
                <Repeat className="w-3.5 h-3.5" /> 歷史總觸發次數
              </div>
              <div className="text-2xl font-bold">{result.totalTrades}</div>
              <div className="text-xs text-[var(--text-secondary)] mt-1">
                勝 {result.wins} / 敗 {result.losses} / 平 {result.neutral}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-white/5">
              <div className="flex items-center gap-2 text-[var(--text-secondary)] text-xs mb-2">
                <Target className="w-3.5 h-3.5" /> 歷史勝率
              </div>
              <div
                className={`text-2xl font-bold ${
                  result.winRate != null && result.winRate >= 0.75
                    ? 'text-[var(--accent-green)]'
                    : 'text-[var(--accent-red)]'
                }`}
              >
                {fmtPct(result.winRate)}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-white/5">
              <div className="flex items-center gap-2 text-[var(--text-secondary)] text-xs mb-2">
                <Clock className="w-3.5 h-3.5" /> 平均達成 8% 等待天數
              </div>
              <div className="text-2xl font-bold">{fmtDays(result.avgDaysToTarget)}</div>
            </div>
          </div>

          {liveBias && (
            <div className="rounded-xl bg-[var(--bg-card)] border border-white/5 p-4">
              <div className="flex items-center gap-2 text-[var(--text-secondary)] text-xs mb-3">
                <Activity className="w-3.5 h-3.5 text-[var(--accent)]" />
                目前乖離率（昨收 vs 60 日均線）· 更新 {formatDate(liveBias.asOf)}
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-3">
                <div>
                  <div className="text-xs text-[var(--text-secondary)] mb-1">
                    目前乖離率{liveBias.livePriceBias != null && Math.abs(liveBias.livePriceBias - liveBias.latestBias!) > 0.001 ? `（昨收 ${fmtPct(liveBias.latestBias)}）` : ''}
                  </div>
                  <div
                    className={`text-2xl font-bold ${
                      currentTriggerThreshold != null
                        ? 'text-[var(--accent-green)]'
                        : distanceToTargetPct != null && distanceToTargetPct <= 1
                          ? 'text-[var(--accent)]'
                          : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {liveBias.livePriceBias != null ? fmtPct(liveBias.livePriceBias) : fmtPct(liveBias.latestBias)}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] mt-1">
                    MA60：{liveBias.ma60.toFixed(2)} · 昨收 {liveBias.latestClose.toFixed(2)}
                    {liveBias.livePrice != null ? ` · 現價 ${liveBias.livePrice.toFixed(2)}` : ''}
                  </div>
                </div>

                {bestThreshold != null && (
                  <div className="border-l border-white/10 pl-6">
                    <div className="text-xs text-[var(--text-secondary)] mb-1">最佳進場閾值 {fmtPct(bestThreshold / 100)}</div>
                    {targetClosePrice != null && (
                      <div className="text-xl font-bold text-[var(--text-primary)]">
                        {targetClosePrice.toFixed(2)}
                        <span className="text-xs font-normal text-[var(--text-secondary)] ml-1">（收盤價需 ≤ 此價才觸發）</span>
                      </div>
                    )}
                    <div className="text-xs mt-1">
                      {currentTriggerThreshold != null ? (
                        <span className="text-[var(--accent-green)]">
                          已達閾值（{fmtPct(currentTriggerThreshold / 100)}），目前在進場區
                        </span>
                      ) : distanceToTargetPct != null ? (
                        <span className="text-[var(--text-secondary)]">
                          距最佳進場還需再跌 {distanceToTargetPct.toFixed(1)}%
                        </span>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="rounded-xl bg-[var(--bg-card)] border border-white/5 p-4">
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-sm font-medium">股價 vs 60 日均線（近 {years || 5} 年）</h2>
              {currentBias != null && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    currentTriggerThreshold != null
                      ? 'bg-[var(--accent-green)]/10 text-[var(--accent-green)]'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                  }`}
                >
                  目前乖離 {fmtPct(currentBias)}
                </span>
              )}
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => formatDate(v as number)}
                    stroke="var(--text-secondary)"
                    fontSize={11}
                    minTickGap={40}
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    stroke="var(--text-secondary)"
                    fontSize={11}
                    tickFormatter={(v) => v.toLocaleString()}
                    width={70}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelFormatter={(v) => formatDate(v as number)}
                    formatter={(value, name) => [Number(value).toLocaleString(), name === 'close' ? '收盤價' : 'MA60']}
                  />
                  <Line type="monotone" dataKey="close" stroke="var(--accent)" dot={false} strokeWidth={1.7} />
                  <Line type="monotone" dataKey="ma60" stroke="var(--accent-green)" dot={false} strokeWidth={1.3} strokeDasharray="4 3" />
                  {triggerPoints.map((p, i) => (
                    <ReferenceDot
                      key={i}
                      x={p.date}
                      y={p.close}
                      r={4}
                      fill="var(--accent-red)"
                      stroke="var(--accent-red)"
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-3">
              紅點為歷史進場觸發點。圖表與勝率回測基準皆為近 {years || 5} 年。
            </p>
          </div>

          {result.allThresholds && result.allThresholds.length > 0 && (
            <div className="rounded-xl bg-[var(--bg-card)] border border-white/5 overflow-hidden">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 border-b border-white/5">
                <h2 className="text-sm font-medium">各閾值回測結果</h2>
                {currentBias != null && (
                  <span className="text-xs text-[var(--text-secondary)]">
                    目前乖離率 <span className="text-[var(--text-primary)] font-medium">{fmtPct(currentBias)}</span>
                    {currentTriggerThreshold != null ? (
                      <>
                        {' '}位於閾值區間「≤ {fmtPct(currentTriggerThreshold / 100)}」內（已達進場條件）
                      </>
                    ) : bestThreshold != null ? (
                      <>
                        {' '}尚未達到任何進場閾值（最佳為 {fmtPct(bestThreshold / 100)}）
                      </>
                    ) : null}
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[var(--text-secondary)] text-xs border-b border-white/5">
                      <HeaderCell
                        label="進場乖離率"
                        sortable
                        active={sortKey === 'threshold'}
                        dir={sortDir}
                        onSort={() => toggleSort('threshold')}
                        help={COLUMN_HELP.threshold}
                        helpAlign="left"
                      />
                      <HeaderCell
                        label="交易次數"
                        sortable
                        active={sortKey === 'totalTrades'}
                        dir={sortDir}
                        onSort={() => toggleSort('totalTrades')}
                        help={COLUMN_HELP.totalTrades}
                      />
                      <HeaderCell
                        label="勝率"
                        sortable
                        active={sortKey === 'winRate'}
                        dir={sortDir}
                        onSort={() => toggleSort('winRate')}
                        help={COLUMN_HELP.winRate}
                      />
                      <HeaderCell label="進場價區間" help={COLUMN_HELP.range} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row) => {
                      const isOpen = expandedThreshold === row.threshold
                      return (
                        <Fragment key={row.threshold}>
                          <tr
                            onClick={() => setExpandedThreshold(isOpen ? null : row.threshold)}
                            className={`border-b border-white/5 last:border-0 cursor-pointer transition ${
                              isOpen ? 'bg-white/5' : 'hover:bg-white/5'
                            }`}
                          >
                            <td className="px-4 py-2 font-mono">
                              <span className="flex items-center gap-1.5">
                                {fmtPct(row.threshold / 100)}
                                {row.threshold === result.bestThreshold && (
                                  <span className="text-[var(--accent)] text-xs">最佳</span>
                                )}
                                {currentBias != null && currentBias <= row.threshold / 100 && (
                                  <span className="text-[var(--accent-green)] text-[10px] bg-[var(--accent-green)]/10 px-1.5 py-0.5 rounded-full">
                                    目前乖離已觸發
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="px-4 py-2">{row.totalTrades}</td>
                            <td className="px-4 py-2">{fmtPct(row.winRate)}</td>
                            <td className="px-4 py-2 font-mono text-[var(--text-primary)]">
                              <span className="flex items-center gap-2">
                                {fmtPriceRange(row.trades)}
                                <span className="ml-auto">
                                  {isOpen ? (
                                    <ChevronUp className="w-4 h-4 text-[var(--text-secondary)]" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
                                  )}
                                </span>
                              </span>
                            </td>
                          </tr>
                          {isOpen && (
                            <tr className="bg-[var(--bg-secondary)]/60 border-b border-white/5">
                              <td colSpan={4} className="px-4 py-3">
                                  {row.trades && row.trades.length > 0 ? (
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="text-[var(--text-secondary)]">
                                            <th className="px-3 py-1.5 text-left">進場日期</th>
                                            <th className="px-3 py-1.5 text-left">進場價</th>
                                            <th className="px-3 py-1.5 text-left">結果</th>
                                            <th className="px-3 py-1.5 text-left">達成 8% 天數</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {row.trades
                                            .slice()
                                            .sort((a, b) => a.entryDate - b.entryDate)
                                            .map((t, ti) => (
                                              <tr key={ti} className="border-b border-white/5 last:border-0">
                                                <td className="px-3 py-1.5 text-[var(--text-primary)]">
                                                  {formatDate(t.entryDate)}
                                                </td>
                                                <td className="px-3 py-1.5 font-mono">{t.entryPrice.toFixed(2)}</td>
                                                <td className="px-3 py-1.5">
                                                  <OutcomeBadge outcome={t.outcome} />
                                                </td>
                                                <td className="px-3 py-1.5">
                                                  {t.outcome === 'win' && t.daysToTarget != null
                                                    ? `${t.daysToTarget} 天`
                                                    : '—'}
                                                </td>
                                              </tr>
                                            ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <p className="text-[var(--text-secondary)] text-xs">無觸發交易</p>
                                  )}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {showTop && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowTop(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-[var(--bg-card)] border border-white/10 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <ListOrdered className="w-5 h-5 text-[var(--accent)]" />
                <h2 className="text-base font-bold">台股成交量 Top 10（上市）</h2>
              </div>
              <button
                onClick={() => setShowTop(false)}
                className="p-1.5 rounded-lg hover:bg-white/5 text-[var(--text-secondary)]"
                aria-label="關閉"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-1.5 px-5 pt-4">
              {(
                [
                  ['day', '當日'],
                  ['week', '當週'],
                  ['month', '當月'],
                  ['quarter', '當季'],
                ] as [TopVolumeRange, string][]
              ).map(([r, label]) => (
                <button
                  key={r}
                  onClick={() => void loadTop(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    topRange === r
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="px-5 py-4">
              {topLoading ? (
                <div className="py-10 text-center text-[var(--text-secondary)]">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                  {topRange === 'day' ? '抓取資料中...' : '累加近期成交量中，可能需要幾秒...'}
                </div>
              ) : topError ? (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {topError}
                </div>
              ) : topList.length === 0 ? (
                <div className="py-10 text-center text-[var(--text-secondary)] text-sm">查無資料</div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  {topList.map((item) => (
                    <button
                      key={item.symbol}
                      onClick={() => pickTopStock(item)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition text-left"
                    >
                      <span className="w-6 shrink-0 text-center font-mono text-xs text-[var(--text-secondary)]">
                        {item.rank}
                      </span>
                      <span className="font-mono text-sm text-[var(--accent)] w-16 shrink-0">{item.symbol}</span>
                      <span className="flex-1 text-sm text-[var(--text-primary)] truncate">{item.name}</span>
                      <span className="text-sm text-[var(--text-primary)] font-medium tabular-nums">
                        {fmtVolume(item.volume)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 pb-4 text-xs text-[var(--text-secondary)]">
              點擊任一股票即自動填入代號並開始回測。
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
