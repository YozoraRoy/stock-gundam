'use client'

import { useState, useRef, useCallback, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { BarChart3, Brain, Search as SearchIcon, Clock, History, FileText, ChevronRight, Target, RefreshCw } from 'lucide-react'
import { SearchBar } from '@/components/search-bar'
import { AnalysisCard } from '@/components/analysis-card'
import { ProgressPanel } from '@/components/progress-panel'

interface AnalysisRecord {
  id: number
  ticker: string
  recommendation: string
  summary: string
  full_report_json: string
  created_at: string
}

function AnalyzeContent() {
  const searchParams = useSearchParams()
  const symbolParam = searchParams.get('symbol') || searchParams.get('stock_id') || ''
  
  const [analysis, setAnalysis] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [progress, setProgress] = useState<{ step: string; detail: string }[]>([])
  const [historyRecords, setHistoryRecords] = useState<AnalysisRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // 讀取歷史分析紀錄 (支援傳入 symbol)
  const fetchHistory = useCallback(async (targetSymbol?: string) => {
    setHistoryLoading(true)
    try {
      const querySymbol = targetSymbol !== undefined ? targetSymbol : symbolParam
      const url = querySymbol
        ? `/api/analysis-records?limit=20&symbol=${encodeURIComponent(querySymbol)}`
        : '/api/analysis-records?limit=20'

      const res = await fetch(url)
      const data = await res.json()
      if (data.success && Array.isArray(data.records)) {
        setHistoryRecords(data.records)

        // 若有過濾特定股票且目前尚未設定報告，自動預載最近一筆報告
        if (querySymbol && data.records.length > 0) {
          try {
            const first = data.records[0]
            const parsed = JSON.parse(first.full_report_json)
            setAnalysis(parsed)
            setSelectedRecordId(first.id)
          } catch (_) {}
        }
      }
    } catch (e) {
      console.error('Failed to load analysis history:', e)
    } finally {
      setHistoryLoading(false)
    }
  }, [symbolParam])

  useEffect(() => {
    fetchHistory(symbolParam)
  }, [fetchHistory, symbolParam])

  const handleAnalyze = useCallback(async (symbol: string) => {
    setLoading(true)
    setAnalysis(null)
    setError(null)
    setProgress([])
    setElapsed(0)
    setSelectedRecordId(null)
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: JSON.stringify({ symbol, date: new Date().toISOString().split('T')[0] }),
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(body.error || `HTTP ${res.status}`)
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

          switch (eventType) {
            case 'progress':
              setProgress(prev => [...prev, parsed])
              break
            case 'result':
              setAnalysis(parsed)
              // 分析成功後刷新歷史列表
              fetchHistory()
              break
            case 'error':
              setError(parsed.message)
              break
          }
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setError(e.message)
      }
    } finally {
      setLoading(false)
      if (timerRef.current) clearInterval(timerRef.current)
      abortRef.current = null
    }
  }, [fetchHistory])

  // 點擊歷史紀錄載入該報告
  const handleSelectHistoryRecord = (record: AnalysisRecord) => {
    try {
      const parsedReport = JSON.parse(record.full_report_json)
      setAnalysis(parsedReport)
      setSelectedRecordId(record.id)
      window.scrollTo({ top: 300, behavior: 'smooth' })
    } catch (e) {
      console.error('Failed to parse historical report JSON:', e)
    }
  }

  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60

  const getRecommendationBadge = (rec: string) => {
    const r = (rec || '').toUpperCase()
    if (r.includes('BUY') || r.includes('OVERWEIGHT')) {
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    } else if (r.includes('SELL') || r.includes('UNDERWEIGHT')) {
      return 'bg-rose-500/20 text-rose-400 border-rose-500/30'
    }
    return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-white/5">
          <BarChart3 className="w-5 h-5 text-[var(--accent)] mb-2" />
          <div className="text-sm text-[var(--text-secondary)]">Markets</div>
          <div className="text-lg font-semibold">US + Taiwan</div>
        </div>
        <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-white/5">
          <Brain className="w-5 h-5 text-[var(--accent-green)] mb-2" />
          <div className="text-sm text-[var(--text-secondary)]">AI Analysis</div>
          <div className="text-lg font-semibold">8 agents</div>
        </div>
        <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-white/5">
          <Clock className="w-5 h-5 text-[var(--accent)] mb-2" />
          <div className="text-sm text-[var(--text-secondary)]">Est. time</div>
          <div className="text-lg font-semibold">3-5 min</div>
        </div>
      </div>

      <SearchBar onSearch={handleAnalyze} loading={loading} />

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {loading && (
          <div className="lg:col-span-1">
            <ProgressPanel progress={progress} />
          </div>
        )}

        <div className={loading ? 'lg:col-span-2' : 'lg:col-span-3'}>
          {loading && (
            <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-white/5 mb-6">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 bg-[var(--accent)] rounded-full animate-pulse" />
                <span className="text-sm font-medium">
                  Running analysis... ({minutes}:{String(seconds).padStart(2, '0')})
                </span>
              </div>
              <div className="text-xs text-[var(--text-secondary)]">
                Running 8 AI agents sequentially via OpenCode LLM models
              </div>
            </div>
          )}

          {analysis && (
            <div className="space-y-4">
              {selectedRecordId && (
                <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-lg text-emerald-400 text-xs">
                  <span>已載入歷史分析報告 (Record #{selectedRecordId})</span>
                  <button 
                    onClick={() => setSelectedRecordId(null)}
                    className="hover:underline text-[var(--text-secondary)]"
                  >
                    關閉提示
                  </button>
                </div>
              )}
              <AnalysisCard analysis={analysis} />
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
              Error: {error}
            </div>
          )}
        </div>
      </div>

      {/* 📜 歷史 AI 分析報告區塊 */}
      <div className="mt-12 border-t border-white/10 pt-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[var(--accent)]" />
            <h2 className="text-xl font-bold">
              {symbolParam ? `${symbolParam} 專屬 AI 分析歷史紀錄` : '歷史 AI 分析紀錄 (Analysis History)'}
            </h2>
          </div>
          
          <div className="flex items-center gap-3">
            {symbolParam && (
              <a
                href="/analyze"
                className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1 bg-[var(--accent)]/10 border border-[var(--accent)]/20 px-2.5 py-1 rounded-lg"
              >
                <span>清除專屬視角 (看全部)</span>
              </a>
            )}
            <button
              onClick={() => fetchHistory()}
              disabled={historyLoading}
              className="text-xs text-[var(--text-secondary)] hover:text-white transition-colors flex items-center gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
              <span>{historyLoading ? '刷新中...' : '重新整理'}</span>
            </button>
          </div>
        </div>

        {historyRecords.length === 0 ? (
          <div className="bg-[var(--bg-card)] rounded-xl p-8 border border-white/5 text-center text-sm text-[var(--text-secondary)]">
            {symbolParam ? (
              <div className="space-y-3">
                <p className="font-medium text-white text-base">尚無 {symbolParam} 的歷史 AI 評估紀錄</p>
                <p className="text-xs">您可以直接點擊上方搜尋欄一鍵為 {symbolParam} 生成全新的 AI 評估報告！</p>
                <button
                  onClick={() => handleAnalyze(symbolParam)}
                  disabled={loading}
                  className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] text-white font-medium text-xs hover:opacity-90 transition"
                >
                  <Brain className="w-4 h-4" />
                  <span>立即對 {symbolParam} 進行 AI 評估</span>
                </button>
              </div>
            ) : (
              '尚無歷史分析紀錄。請在上方搜尋框輸入股票代號（例如 2330.TW 或 SPCX）開始進行 AI 評估！'
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {historyRecords.map(record => (
              <div
                key={record.id}
                onClick={() => handleSelectHistoryRecord(record)}
                className={`bg-[var(--bg-card)] hover:bg-white/5 transition-all cursor-pointer rounded-xl p-4 border ${
                  selectedRecordId === record.id
                    ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]'
                    : 'border-white/5 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[var(--text-secondary)]" />
                    <span className="font-bold text-lg">{record.ticker}</span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getRecommendationBadge(record.recommendation)}`}>
                    {record.recommendation}
                  </span>
                </div>

                {record.summary && (
                  <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-3">
                    {record.summary}
                  </p>
                )}

                <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)] border-t border-white/5 pt-2">
                  <span>{record.created_at}</span>
                  <span className="flex items-center gap-0.5 text-[var(--accent)] hover:underline">
                    查看完整報告 <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function AnalyzePage() {
  return (
    <Suspense fallback={
      <div className="max-w-6xl mx-auto px-4 py-16 text-center text-sm text-[var(--text-secondary)]">
        載入專屬 AI 分析頁面中...
      </div>
    }>
      <AnalyzeContent />
    </Suspense>
  )
}
