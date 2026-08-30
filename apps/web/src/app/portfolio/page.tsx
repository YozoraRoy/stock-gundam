'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingUp, Zap, RefreshCw, Sparkles, History, ChevronDown, ChevronUp, Upload, Trash2, CheckCircle2 } from 'lucide-react'

type Market = 'tw' | 'us'

const STRATEGIES = [
  { id: 'buffett', nameZh: '巴菲特價值投資', nameEn: 'Value Investing' },
  { id: 'growth', nameZh: '成長股投資', nameEn: 'Growth Investing' },
  { id: 'dividend', nameZh: '股息現金流投資', nameEn: 'Dividend Investing' },
  { id: 'momentum', nameZh: '技術面順勢投資', nameEn: 'Momentum' },
  { id: 'balanced', nameZh: '穩健風險控管', nameEn: 'Balanced Risk' },
]

interface PnL {
  costBasis: number
  marketValue: number
  unrealizedPnl: number
  unrealizedPnlPct: number
  totalReturn: number
  totalReturnPct: number
  yieldOnCost: number
}

interface Advice {
  rating: 'BUY' | 'HOLD' | 'SELL' | 'AVOID'
  confidence: number
  fairValue?: number
  marginOfSafety?: number
  upsideDownsidePct?: number
  summary: string
  keyPoints: string[]
  risks: string[]
  action: string
}

interface HistoryItem {
  id: number
  market: Market
  symbol: string
  symbol_name: string | null
  shares: number
  cost: number
  current_price: number
  dividend: number
  cost_basis: number
  market_value: number
  unrealized_pnl: number
  unrealized_pnl_pct: number
  total_return: number
  total_return_pct: number
  yield_on_cost: number
  strategy: string | null
  recommendation: string | null
  summary: string | null
  report_json: string | null
  created_at: string
}

interface RecognizedPosition {
  market: Market
  symbol: string
  symbolName?: string
  shares: number
  cost: number
  currentPrice: number
  dividend: number
}

const RATING_STYLE: Record<string, { text: string; bg: string }> = {
  BUY: { text: 'text-[var(--accent-green)]', bg: 'var(--accent-green)' },
  HOLD: { text: 'text-[var(--accent)]', bg: 'var(--accent)' },
  SELL: { text: 'text-[var(--accent-red)]', bg: 'var(--accent-red)' },
  AVOID: { text: 'text-[var(--text-secondary)]', bg: 'var(--text-secondary)' },
}

function formatMoney(n: number, market: Market): string {
  const symbol = market === 'tw' ? 'NT$' : '$'
  return `${symbol}${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

function formatPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

function num(s: string): number | null {
  if (!s.trim()) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export default function PortfolioPage() {
  const router = useRouter()

  const [market, setMarket] = useState<Market>('tw')
  const [symbol, setSymbol] = useState('')
  const [symbolName, setSymbolName] = useState<string>('')
  const [shares, setShares] = useState('')
  const [cost, setCost] = useState('')
  const [currentPrice, setCurrentPrice] = useState('')
  const [dividend, setDividend] = useState('')
  const [strategyId, setStrategyId] = useState('buffett')

  const [quoteLoading, setQuoteLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [savedResult, setSavedResult] = useState<(PnL & { id: number; market: Market; symbol: string; symbolName?: string }) | null>(null)
  const [aiResult, setAiResult] = useState<{ advice: Advice; strategy: { nameZh: string; nameEn: string }; usedFallback?: boolean } | null>(null)
  const [progress, setProgress] = useState<{ step: string; detail: string }[]>([])

  const [history, setHistory] = useState<HistoryItem[]>([])
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [recognizing, setRecognizing] = useState(false)
  const [recognitionQuota, setRecognitionQuota] = useState<{ used: number; max: number; remaining: number } | null>(null)
  const [recognized, setRecognized] = useState<Array<RecognizedPosition & { saved?: boolean }>>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const buildPayload = () => {
    const nShares = num(shares)
    const nCost = num(cost)
    const nPrice = num(currentPrice)
    const nDiv = num(dividend) ?? 0
    if (!symbol.trim()) {
      setError('請輸入股票代號')
      return null
    }
    if (nShares == null || !(nShares > 0)) {
      setError('持有股數需大於 0')
      return null
    }
    if (nCost == null || nCost < 0) {
      setError('每股成本不能為負')
      return null
    }
    if (nPrice == null || !(nPrice > 0)) {
      setError('每股現價需大於 0')
      return null
    }
    return {
      market,
      symbol: symbol.trim().toUpperCase(),
      shares: nShares,
      cost: nCost,
      currentPrice: nPrice,
      dividend: nDiv,
      symbolName: symbolName || undefined,
    }
  }

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/portfolio/records?limit=20')
      const data = await res.json()
      if (data.success) setHistory(data.records)
    } catch (e) {
      console.error('Failed to fetch portfolio history:', e)
    }
  }

  const fetchRecognitionQuota = async () => {
    try {
      const res = await fetch('/api/portfolio/recognize')
      const data = await res.json()
      if (data && typeof data.remaining === 'number') setRecognitionQuota(data)
    } catch {}
  }

  useEffect(() => {
    fetchRecognitionQuota()
  }, [])

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('讀取圖片失敗'))
      reader.onload = () => {
        const img = new Image()
        img.onerror = () => reject(new Error('圖片格式無法辨識'))
        img.onload = () => {
          const MAX = 1600
          let { width, height } = img
          if (width > MAX || height > MAX) {
            const ratio = Math.min(MAX / width, MAX / height)
            width = Math.round(width * ratio)
            height = Math.round(height * ratio)
          }
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('無法處理圖片'))
            return
          }
          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', 0.85))
        }
        img.src = reader.result as string
      }
      reader.readAsDataURL(file)
    })
  }

  const handleRecognize = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('請上傳圖片檔（PNG/JPG 等）')
      return
    }
    setError(null)
    setRecognizing(true)
    setRecognized([])
    try {
      const preview = await resizeImage(file)
      setImagePreview(preview)
      const res = await fetch('/api/portfolio/recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: preview }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        if (typeof data?.quota?.used === 'number') setRecognitionQuota(data.quota)
        setRecognizing(false)
        return
      }
      const positions = (data.positions ?? []).map((p: RecognizedPosition) => ({
        market: p.market === 'us' ? 'us' : 'tw',
        symbol: p.symbol,
        symbolName: p.symbolName,
        shares: p.shares,
        cost: p.cost,
        currentPrice: p.currentPrice,
        dividend: p.dividend ?? 0,
        saved: false,
      }))
      setRecognized(positions)
      if (data.quota) setRecognitionQuota(data.quota)
      if (positions.length === 0) setError('未辨識到任何股票，請確認圖片清楚後重試')
    } catch (e: any) {
      setError(e.message || '辨識失敗，請再試一次')
    } finally {
      setRecognizing(false)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleRecognize(file)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleRecognize(file)
  }

  const updateRecognized = (index: number, patch: Partial<RecognizedPosition> & { saved?: boolean }) => {
    setRecognized((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch, saved: false } : p)))
  }

  const saveRecognizedPosition = async (p: RecognizedPosition & { saved?: boolean }, index: number) => {
    try {
      const res = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market: p.market,
          symbol: p.symbol.toUpperCase(),
          shares: p.shares,
          cost: p.cost,
          currentPrice: p.currentPrice,
          dividend: p.dividend ?? 0,
          symbolName: p.symbolName || undefined,
          strategyId,
        }),
      })
      const data = await res.json()
      if (data.error) {
        setError(`「${p.symbol}」存檔失敗：${data.error}`)
        return false
      }
      updateRecognized(index, { saved: true })
      await fetchHistory()
      return true
    } catch {
      setError(`「${p.symbol}」存檔發生錯誤`)
      return false
    }
  }

  const saveAllRecognized = async () => {
    const pending = recognized.map((p, i) => ({ p, i })).filter((x) => !x.p.saved)
    let ok = 0
    for (const { p, i } of pending) {
      const r = await saveRecognizedPosition(p, i)
      if (r) ok++
    }
    setNotice(ok > 0 ? `已建立 ${ok} 筆持股紀錄` : null)
  }

  const clearRecognition = () => {
    setImagePreview(null)
    setRecognized([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/auth/me')
        const data = await res.json()
        if (!data?.success) {
          router.replace('/login?redirect=/portfolio')
          return
        }
        await fetchHistory()
      } catch {}
    })()
  }, [router])

  useEffect(() => () => abortRef.current?.abort(), [])

  const handleFetchQuote = async () => {
    const sym = symbol.trim()
    if (!sym) {
      setError('請先輸入股票代號')
      return
    }
    setQuoteLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/portfolio/quote?symbol=${encodeURIComponent(sym)}&market=${market}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '無法取得報價')
        return
      }
      setCurrentPrice(String(data.price))
      if (data.name) setSymbolName(data.name)
      setNotice(`已取得 ${data.symbol} 即時報價：${data.price}`)
    } catch (e: any) {
      setError(e.message || '報價查詢失敗')
    } finally {
      setQuoteLoading(false)
    }
  }

  const handleSave = async () => {
    const payload = buildPayload()
    if (!payload) return
    setSaving(true)
    setError(null)
    setNotice(null)
    setAiResult(null)
    try {
      const res = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`)
        return
      }
      setSavedResult(data.record)
      setNotice('已儲存損益試算紀錄')
      await fetchHistory()
    } catch (e: any) {
      setError(e.message || '儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  const handleAnalyze = async () => {
    const payload = buildPayload()
    if (!payload) return
    setAnalyzing(true)
    setError(null)
    setNotice(null)
    setAiResult(null)
    setProgress([])

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/portfolio/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, strategyId }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        if (res.status === 401) {
          router.replace(`/login?redirect=${encodeURIComponent('/portfolio')}`)
          return
        }
        if (res.status === 429) {
          setError(body.error || `今日額度已用完 (${body.quota?.used ?? 3}/3)`)
          return
        }
        setError(body.error || `HTTP ${res.status}`)
        return
      }

      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const blocks = buffer.split('\n\n')
        buffer = blocks.pop() || ''
        for (const block of blocks) {
          const lines = block.split('\n')
          let eventType = 'message'
          let data = ''
          for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.slice(7)
            else if (line.startsWith('data: ')) data = line.slice(6)
          }
          if (!data) continue
          const parsed = JSON.parse(data)
          if (eventType === 'progress') setProgress(prev => [...prev, parsed])
          else if (eventType === 'result') {
            setAiResult(parsed)
            window.dispatchEvent(new Event('quota-updated'))
            await fetchHistory()
          } else if (eventType === 'error') setError(parsed.message)
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') setError(e.message)
    } finally {
      setAnalyzing(false)
      abortRef.current = null
    }
  }

  const ratingColor = (rating?: string | null) => (rating ? RATING_STYLE[rating]?.text || 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]')

  const expandHistory = (item: HistoryItem) => {
    setExpandedId(prev => (prev === item.id ? null : item.id))
  }

  const strategyName = (id: string | null) => STRATEGIES.find(s => s.id === id)?.nameZh ?? id ?? ''
  const currency = market === 'tw' ? 'NT$' : '$'

  const inputCls =
    'w-full bg-[var(--bg-secondary)] border border-white/10 rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-50'

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <TrendingUp className="w-8 h-8 text-[var(--accent-green)]" />
        <div>
          <h1 className="text-2xl font-bold">個人損益試算</h1>
          <p className="text-sm text-[var(--text-secondary)]">輸入持有部位，試算損益並套用投資法則取得 AI 建議</p>
        </div>
      </div>

      {/* AI 圖片辨識上傳 */}
      <div className="bg-[var(--bg-card)] rounded-2xl border border-white/5 p-6 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium flex items-center gap-2">
            <Upload className="w-4 h-4 text-[var(--accent)]" />
            AI 圖片辨識上傳持股
          </h2>
          {recognitionQuota != null && (
            <span className="text-xs text-[var(--text-secondary)]">
              今日剩餘辨識次數：<span className={recognitionQuota.remaining > 0 ? 'text-[var(--accent-green)]' : 'text-red-400'}>{recognitionQuota.remaining}</span> / {recognitionQuota.max}
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--text-secondary)] mb-4">上傳券商 App 持股截圖或對帳單照片，AI 自動辨識多檔股票，逐檔建立損益紀錄。</p>

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileInput} />
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer border-2 border-dashed border-white/10 hover:border-[var(--accent)] rounded-xl p-8 text-center transition group"
        >
          <Upload className="w-10 h-10 mx-auto mb-3 text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition" />
          {recognizing ? (
            <p className="text-sm text-[var(--text-secondary)]">AI 辨識中，請稍候...</p>
          ) : (
            <>
              <p className="text-sm text-[var(--text-primary)]">點擊或拖曳圖片到此處</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">支援 PNG / JPG，最多 10MB（Screenshot / 拍照皆可）</p>
            </>
          )}
        </div>

        {imagePreview && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <img src={imagePreview} alt="上傳預覽" className="max-h-64 w-auto rounded-lg border border-white/10" />
            </div>
            {recognized.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-[var(--accent-green)]">辨識到 {recognized.length} 檔持股</p>
                  <button
                    type="button"
                    onClick={() => setRecognized([])}
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    清除結果
                  </button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {recognized.map((p, i) => (
                    <div key={i} className="border border-white/10 rounded-lg p-3 space-y-2">
                      <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                        <div className="flex gap-2 items-center text-sm">
                          <select
                            value={p.market}
                            onChange={e => updateRecognized(i, { market: e.target.value as Market })}
                            className="bg-[var(--bg-secondary)] border border-white/10 rounded px-1 py-0.5 text-xs"
                          >
                            <option value="tw">台股</option>
                            <option value="us">美股</option>
                          </select>
                          <input
                            value={p.symbol}
                            onChange={e => updateRecognized(i, { symbol: e.target.value.toUpperCase() })}
                            className="w-20 bg-[var(--bg-secondary)] border border-white/10 rounded px-2 py-0.5 text-sm"
                          />
                          <input
                            value={p.symbolName ?? ''}
                            placeholder="名稱"
                            onChange={e => updateRecognized(i, { symbolName: e.target.value })}
                            className="w-24 bg-[var(--bg-secondary)] border border-white/10 rounded px-2 py-0.5 text-sm"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setRecognized(prev => prev.filter((_, j) => j !== i))}
                          className="text-[var(--text-secondary)] hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <label className="flex flex-col gap-0.5">
                          <span className="text-[var(--text-secondary)]">股數</span>
                          <input type="number" min="0" value={p.shares} onChange={e => updateRecognized(i, { shares: Number(e.target.value) || 0 })} className="bg-[var(--bg-secondary)] border border-white/10 rounded px-2 py-1" />
                        </label>
                        <label className="flex flex-col gap-0.5">
                          <span className="text-[var(--text-secondary)]">成本</span>
                          <input type="number" min="0" step="0.01" value={p.cost} onChange={e => updateRecognized(i, { cost: Number(e.target.value) || 0 })} className="bg-[var(--bg-secondary)] border border-white/10 rounded px-2 py-1" />
                        </label>
                        <label className="flex flex-col gap-0.5">
                          <span className="text-[var(--text-secondary)]">現價</span>
                          <input type="number" min="0" step="0.01" value={p.currentPrice} onChange={e => updateRecognized(i, { currentPrice: Number(e.target.value) || 0 })} className="bg-[var(--bg-secondary)] border border-white/10 rounded px-2 py-1" />
                        </label>
                        <label className="flex flex-col gap-0.5">
                          <span className="text-[var(--text-secondary)]">股息</span>
                          <input type="number" min="0" step="0.01" value={p.dividend} onChange={e => updateRecognized(i, { dividend: Number(e.target.value) || 0 })} className="bg-[var(--bg-secondary)] border border-white/10 rounded px-2 py-1" />
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={p.saved}
                          onClick={() => saveRecognizedPosition(p, i)}
                          className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition ${p.saved ? 'bg-[var(--accent-green)]/20 text-[var(--accent-green)]' : 'bg-white/10 hover:bg-white/15'}`}
                        >
                          {p.saved ? <><CheckCircle2 className="w-3.5 h-3.5" /> 已存檔</> : '建立損益紀錄'}
                        </button>
                        {p.saved && (
                          <button
                            type="button"
                            onClick={async () => {
                              await fetchHistory()
                              setNotice(`「${p.symbol}」紀錄已更新`)
                              setExpandedId(null)
                            }}
                            className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                          >
                            查看紀錄
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={saveAllRecognized}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent-green)] text-white text-sm font-medium hover:opacity-90 transition"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  全部建立損益紀錄
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 輸入表單 */}
        <div className="bg-[var(--bg-card)] rounded-2xl border border-white/5 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">市場</span>
            <div className="flex rounded-lg overflow-hidden border border-white/10">
              {(['tw', 'us'] as Market[]).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMarket(m); setSymbol(''); setSymbolName(''); setCurrentPrice('') }}
                  className={`px-4 py-1.5 text-sm transition ${market === m ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                >
                  {m === 'tw' ? '台股' : '美股'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">股票代號 {market === 'tw' ? '(例如 2330 / 2330.TW)' : '(例如 AAPL / MSFT)'}</label>
            <div className="flex gap-2">
              <input value={symbol} onChange={e => setSymbol(e.target.value)} placeholder={market === 'tw' ? '2330' : 'AAPL'} className={inputCls} />
              <button
                type="button"
                onClick={handleFetchQuote}
                disabled={quoteLoading}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 text-sm hover:bg-white/15 transition disabled:opacity-50"
              >
                {quoteLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                抓取現價
              </button>
            </div>
            {symbolName && <p className="mt-1 text-xs text-[var(--accent)]">{symbolName}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">持有股數</label>
              <input type="number" min="0" step="1" value={shares} onChange={e => setShares(e.target.value)} placeholder="1000" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">每股成本 ({currency})</label>
              <input type="number" min="0" step="0.01" value={cost} onChange={e => setCost(e.target.value)} placeholder="100" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">每股現價 ({currency})</label>
              <input type="number" min="0" step="0.01" value={currentPrice} onChange={e => setCurrentPrice(e.target.value)} placeholder="110" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">累計股息 ({currency})</label>
              <input type="number" min="0" step="0.01" value={dividend} onChange={e => setDividend(e.target.value)} placeholder="0" className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">AI 投資法則</label>
            <select value={strategyId} onChange={e => setStrategyId(e.target.value)} className={inputCls}>
              {STRATEGIES.map(s => (
                <option key={s.id} value={s.id}>{s.nameZh}（{s.nameEn}）</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || analyzing}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 text-sm font-medium hover:bg-white/15 transition disabled:opacity-50"
            >
              <History className="w-4 h-4" />
              {saving ? '儲存中...' : '儲存損益試算'}
            </button>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={analyzing || saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {analyzing ? 'AI 分析中...' : 'AI 分析建議'}
            </button>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
          {notice && <p className="text-xs text-[var(--accent)]">{notice}</p>}

          {analyzing && (
            <div className="space-y-1">
              {progress.map((p, i) => (
                <p key={i} className="text-xs text-[var(--text-secondary)]">
                  {p.step}: {p.detail}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* 結果區 */}
        <div className="space-y-4">
          {savedResult && (
            <div className="bg-[var(--bg-card)] rounded-2xl border border-white/5 p-6">
              <h2 className="text-sm font-medium mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[var(--accent-green)]" />
                {savedResult.symbolName || savedResult.symbol} — 損益試算
              </h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[var(--text-secondary)] text-xs">總成本</p>
                  <p className="font-medium">{formatMoney(savedResult.costBasis, savedResult.market)}</p>
                </div>
                <div>
                  <p className="text-[var(--text-secondary)] text-xs">目前市值</p>
                  <p className="font-medium">{formatMoney(savedResult.marketValue, savedResult.market)}</p>
                </div>
                <div>
                  <p className="text-[var(--text-secondary)] text-xs">未實現損益</p>
                  <p className={`font-bold ${savedResult.unrealizedPnl >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
                    {formatMoney(savedResult.unrealizedPnl, savedResult.market)}{' '}
                    <span className="text-xs">{formatPct(savedResult.unrealizedPnlPct)}</span>
                  </p>
                </div>
                <div>
                  <p className="text-[var(--text-secondary)] text-xs">含股息總報酬</p>
                  <p className={`font-bold ${savedResult.totalReturn >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
                    {formatMoney(savedResult.totalReturn, savedResult.market)}{' '}
                    <span className="text-xs">{formatPct(savedResult.totalReturnPct)}</span>
                  </p>
                </div>
                <div>
                  <p className="text-[var(--text-secondary)] text-xs">股息殖利率（成本）</p>
                  <p className="font-medium">{savedResult.yieldOnCost.toFixed(2)}%</p>
                </div>
              </div>
            </div>
          )}

          {aiResult && (
            <div className="bg-[var(--bg-card)] rounded-2xl border border-white/5 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[var(--accent)]" />
                  AI 建議（{aiResult.strategy.nameZh}）
                </h2>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${RATING_STYLE[aiResult.advice.rating]?.text}`}
                  style={{ backgroundColor: `${RATING_STYLE[aiResult.advice.rating]?.bg}22` }}>
                  {aiResult.advice.rating}
                </span>
              </div>
              <p className="text-sm mb-1">信心度：{(aiResult.advice.confidence * 100).toFixed(0)}%</p>
              {(aiResult.advice.fairValue != null || aiResult.advice.marginOfSafety != null || aiResult.advice.upsideDownsidePct != null) && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)] mb-2">
                  {aiResult.advice.fairValue != null && <span>合理價估值：{currency}{aiResult.advice.fairValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>}
                  {aiResult.advice.marginOfSafety != null && <span>安全邊際：{aiResult.advice.marginOfSafety.toFixed(2)}%</span>}
                  {aiResult.advice.upsideDownsidePct != null && <span>預期空間：{formatPct(aiResult.advice.upsideDownsidePct)}</span>}
                </div>
              )}
              <p className="text-sm font-medium mb-2">{aiResult.advice.summary}</p>
              <div className="mb-2">
                <p className="text-xs text-[var(--text-secondary)] mb-1">關鍵判斷</p>
                <ul className="space-y-0.5">
                  {aiResult.advice.keyPoints.map((k, i) => (
                    <li key={i} className="text-xs text-[var(--text-primary)]">• {k}</li>
                  ))}
                </ul>
              </div>
              <div className="mb-3">
                <p className="text-xs text-[var(--text-secondary)] mb-1">主要風險</p>
                <ul className="space-y-0.5">
                  {aiResult.advice.risks.map((r, i) => (
                    <li key={i} className="text-xs text-[var(--accent-red)]">• {r}</li>
                  ))}
                </ul>
              </div>
              <p className="text-sm bg-[var(--bg-secondary)] rounded-lg p-3 border border-white/5">{aiResult.advice.action}</p>
              {aiResult.usedFallback && <p className="mt-2 text-[10px] text-[var(--text-secondary)]">本次分析使用了備援模型</p>}
            </div>
          )}
        </div>
      </div>

      {/* 歷史紀錄 */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-[var(--text-secondary)]" />
          我的損益歷史
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">尚無紀錄，先輸入部位並儲存或執行 AI 分析。</p>
        ) : (
          <div className="space-y-2">
            {history.map(item => {
              const open = expandedId === item.id
              return (
                <div key={item.id} className="bg-[var(--bg-card)] rounded-xl border border-white/5 overflow-hidden">
                  <button type="button" onClick={() => expandHistory(item)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/5 transition">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${ratingColor(item.recommendation)}`}
                        style={item.recommendation ? { backgroundColor: `${RATING_STYLE[item.recommendation]?.bg || 'rgba(255,255,255,0.08)'}22` } : undefined}>
                        {item.recommendation || '—'}
                      </span>
                      <span className="font-medium truncate">{item.symbol_name || item.symbol}</span>
                      <span className="text-xs text-[var(--text-secondary)] shrink-0">{item.symbol}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-sm font-bold ${item.total_return >= 0 ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
                        {formatMoney(item.total_return, item.market)} {formatPct(item.total_return_pct)}
                      </span>
                      {item.strategy && <span className="text-[10px] text-[var(--text-secondary)] hidden md:inline">{strategyName(item.strategy)}</span>}
                      {open ? <ChevronUp className="w-4 h-4 text-[var(--text-secondary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />}
                    </div>
                  </button>
                  {open && (
                    <div className="px-4 pb-4 pt-1 border-t border-white/5">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm pt-3">
                        <div><p className="text-xs text-[var(--text-secondary)]">持有股數</p><p>{item.shares}</p></div>
                        <div><p className="text-xs text-[var(--text-secondary)]">每股成本</p><p>{formatMoney(item.cost, item.market)}</p></div>
                        <div><p className="text-xs text-[var(--text-secondary)]">現價</p><p>{formatMoney(item.current_price, item.market)}</p></div>
                        <div><p className="text-xs text-[var(--text-secondary)]">累計股息</p><p>{formatMoney(item.dividend, item.market)}</p></div>
                        <div><p className="text-xs text-[var(--text-secondary)]">總成本</p><p>{formatMoney(item.cost_basis, item.market)}</p></div>
                        <div><p className="text-xs text-[var(--text-secondary)]">市值</p><p>{formatMoney(item.market_value, item.market)}</p></div>
                        <div className="text-[var(--accent-red)]"><p className="text-xs text-[var(--text-secondary)]">未實現損益</p><p>{formatMoney(item.unrealized_pnl, item.market)} ({formatPct(item.unrealized_pnl_pct)})</p></div>
                        <div><p className="text-xs text-[var(--text-secondary)]">股息殖利率</p><p>{item.yield_on_cost.toFixed(2)}%</p></div>
                        <div className="col-span-2 md:col-span-4">
                          <p className="text-xs text-[var(--text-secondary)]">建立時間</p>
                          <p className="text-xs">{(item.created_at || '').replace('T', ' ')}</p>
                        </div>
                        {item.summary && (
                          <div className="col-span-2 md:col-span-4">
                            <p className="text-xs text-[var(--text-secondary)]">AI 摘要</p>
                            <p className="text-sm">{item.summary}</p>
                          </div>
                        )}
                        {item.report_json && <JsonAdviceView json={item.report_json} market={item.market} />}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function JsonAdviceView({ json, market }: { json: string; market: Market }) {
  const [parsed, setParsed] = useState<{ advice?: Advice } | null>(null)
  useEffect(() => {
    try {
      setParsed(JSON.parse(json))
    } catch {
      setParsed(null)
    }
  }, [json])
  if (!parsed?.advice) return null
  return (
    <div className="col-span-2 md:col-span-4 rounded-lg bg-[var(--bg-secondary)] p-3 border border-white/5 space-y-2">
      <p className="text-xs text-[var(--text-secondary)]">AI 關鍵判斷</p>
      <ul className="space-y-0.5">
        {parsed.advice.keyPoints.map((k, i) => (
          <li key={i} className="text-xs">• {k}</li>
        ))}
      </ul>
      <p className="text-xs text-[var(--accent-red)]">風險</p>
      <ul className="space-y-0.5">
        {parsed.advice.risks.map((r, i) => (
          <li key={i} className="text-xs text-[var(--accent-red)]">• {r}</li>
        ))}
      </ul>
      <p className="text-xs text-[var(--text-secondary)]">行動建議</p>
      <p className="text-sm">{parsed.advice.action}</p>
    </div>
  )
}