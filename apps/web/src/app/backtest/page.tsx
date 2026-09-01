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
import { Search as SearchIcon, TrendingDown, Target, Repeat, Clock, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

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

export default function BacktestPage() {
  const [symbol, setSymbol] = useState('')
  const [holdingDays, setHoldingDays] = useState('40')
  const [targetPct, setTargetPct] = useState('8')
  const [stopPct, setStopPct] = useState('5')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BacktestResponse | null>(null)
  const [expandedThreshold, setExpandedThreshold] = useState<number | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('threshold')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [searching, setSearching] = useState(false)
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

  const runFromSymbol = async (sym: string) => {
    setLoading(true)
    setError(null)
    setResult(null)
    setExpandedThreshold(null)
    try {
      const qs = new URLSearchParams({
        symbol: sym,
        holdingDays: holdingDays || '40',
        target: targetPct || '8',
        stop: stopPct || '5',
      })
      const res = await fetch(`/api/backtest?${qs.toString()}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '回測失敗')
        return
      }
      setResult(data)
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

  const triggerPoints = (result?.series ?? []).filter((p) => p.trigger)
  const chartData = (result?.series ?? []).map((p) => ({
    date: p.date,
    close: p.close,
    ma60: p.ma60 ?? undefined,
  }))

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
        台股季線乖離回測：訊號收盤確認、次一交易日進場，{holdingDays || 40} 日內先 +{targetPct || 8}% 為勝、先 −{stopPct || 5}% 為敗。
      </p>

      <form onSubmit={run} className="mb-8 space-y-3 max-w-2xl">
        <div className="grid grid-cols-3 gap-2">
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
            <span className="block text-xs text-[var(--text-secondary)] mb-1">目標獲利 %</span>
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

          <div className="rounded-xl bg-[var(--bg-card)] border border-white/5 p-4">
            <h2 className="text-sm font-medium mb-3">股價 vs 60 日均線（近 2 年）</h2>
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
              紅點為歷史進場觸發點。圖表顯示近 2 年，勝率回測基準為近 10 年。
            </p>
          </div>

          {result.allThresholds && result.allThresholds.length > 0 && (
            <div className="rounded-xl bg-[var(--bg-card)] border border-white/5 overflow-hidden">
              <h2 className="text-sm font-medium px-4 py-3 border-b border-white/5">各閾值回測結果</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[var(--text-secondary)] text-xs border-b border-white/5">
                      <th className="px-4 py-2 text-left cursor-pointer select-none hover:text-[var(--text-primary)]" onClick={() => toggleSort('threshold')}>
                        <span className="inline-flex items-center">
                          進場乖離率
                          <SortIcon active={sortKey === 'threshold'} dir={sortDir} />
                        </span>
                      </th>
                      <th className="px-4 py-2 text-left cursor-pointer select-none hover:text-[var(--text-primary)]" onClick={() => toggleSort('totalTrades')}>
                        <span className="inline-flex items-center">
                          交易次數
                          <SortIcon active={sortKey === 'totalTrades'} dir={sortDir} />
                        </span>
                      </th>
                      <th className="px-4 py-2 text-left cursor-pointer select-none hover:text-[var(--text-primary)]" onClick={() => toggleSort('winRate')}>
                        <span className="inline-flex items-center">
                          勝率
                          <SortIcon active={sortKey === 'winRate'} dir={sortDir} />
                        </span>
                      </th>
                      <th className="px-4 py-2 text-left">進場價區間</th>
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
                              {fmtPct(row.threshold / 100)}
                              {row.threshold === result.bestThreshold && (
                                <span className="ml-2 text-[var(--accent)] text-xs">最佳</span>
                              )}
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
    </div>
  )
}
