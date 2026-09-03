'use client'

import { useState, useRef, useCallback, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { BarChart3, Brain, Search as SearchIcon, Clock, History, FileText, ChevronRight, Target, RefreshCw, Trash2, Zap } from 'lucide-react'
import { AGENT_KEYS, type AnalysisLanguage } from '@stock/core'
import { SearchBar } from '@/components/search-bar'
import { AnalysisCard } from '@/components/analysis-card'
import { ProgressPanel } from '@/components/progress-panel'
import { AnalysisOptions } from '@/components/analysis-options'

function formatLLMError(raw: string): string {
  if (/rate.?limit|429|tokens per minute|TPM|exhausted/i.test(raw)) {
    return 'AI 模型額度暫時用完，請稍後再試（約 1 分鐘後）'
  }
  return raw
}

interface AnalysisRecord {
  id: number
  ticker: string
  recommendation: string
  summary: string
  full_report_json: string
  model_usage?: string
  fallback_count?: number
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
  const [isAdmin, setIsAdmin] = useState(false)
  const [language, setLanguage] = useState<AnalysisLanguage>('zh-TW')
  const [enabledAgents, setEnabledAgents] = useState<string[]>([...AGENT_KEYS])
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 讀取目前使用者是否為管理者（LINE 帳號 Roy）
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.success && data.user) setIsAdmin(!!data.user.isAdmin)
      })
      .catch(() => {})
  }, [])

  // 從 model_usage JSON 計算該筆分析消耗的總 token 數
  // 舊紀錄 model_usage 可能為空，但完整報告內可能存有 tokenUsage，一併回退讀取
  const getRecordTokens = (record: AnalysisRecord): number | null => {
    if (record.model_usage) {
      try {
        const agents = JSON.parse(record.model_usage) as { totalTokens?: number }[]
        if (Array.isArray(agents)) {
          const total = agents.reduce((sum, a) => sum + (a.totalTokens ?? 0), 0)
          if (total > 0) return total
        }
      } catch {}
    }
    try {
      const report = JSON.parse(record.full_report_json) as {
        tokenUsage?: { total?: { totalTokens?: number } }
      }
      const total = report?.tokenUsage?.total?.totalTokens
      if (typeof total === 'number' && total > 0) return total
    } catch {}
    return null
  }

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

  // LLM 重試倒數計時器
  useEffect(() => {
    if (retryCountdown === null || retryCountdown <= 0) return
    retryTimerRef.current = setInterval(() => {
      setRetryCountdown(prev => {
        if (prev === null || prev <= 1) return null
        return prev - 1
      })
    }, 1000)
    return () => { if (retryTimerRef.current) clearInterval(retryTimerRef.current) }
  }, [retryCountdown !== null])

  const handleAnalyze = useCallback(async (symbol: string) => {
    if (enabledAgents.length === 0) {
      setError('至少須啟用一個 Agent 才能開始分析。請在「AI 分析設定」中啟用。')
      return
    }
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
        body: JSON.stringify({
          symbol,
          date: new Date().toISOString().split('T')[0],
          language,
          agents: enabledAgents,
        }),
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        if (res.status === 401) {
          const redirectUrl = `/login?redirect=${encodeURIComponent(`/analyze?symbol=${encodeURIComponent(symbol)}`)}`
          window.location.href = redirectUrl
          return
        }
        if (res.status === 429) {
          setError(body.error || `今日額度已用完 (${body.quota?.used ?? 3}/3)`)
          return
        }
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
              if (parsed.step === 'LLM' && typeof parsed.detail === 'string') {
                const m = parsed.detail.match(/retrying in (\d+)s/)
                if (m) setRetryCountdown(parseInt(m[1], 10))
              }
              break
            case 'result':
              setAnalysis(parsed)
              setRetryCountdown(null)
              fetchHistory()
              window.dispatchEvent(new Event('quota-updated'))
              break
            case 'error':
              setError(formatLLMError(parsed.message))
              setRetryCountdown(null)
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
      setRetryCountdown(null)
      if (timerRef.current) clearInterval(timerRef.current)
      if (retryTimerRef.current) clearInterval(retryTimerRef.current)
      abortRef.current = null
    }
  }, [fetchHistory, language, enabledAgents])

  const handleToggleAgent = useCallback((key: string) => {
    setEnabledAgents(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key],
    )
  }, [])

  const handleToggleAll = useCallback((enabled: boolean) => {
    setEnabledAgents(enabled ? [...AGENT_KEYS] : [])
  }, [])

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

  // 刪除歷史分析紀錄（僅管理者）
  const handleDeleteRecord = async (record: AnalysisRecord) => {
    if (!window.confirm(`確定要刪除 ${record.ticker} 的分析紀錄 (Record #${record.id}) 嗎？此操作無法復原。`)) {
      return
    }
    try {
      const res = await fetch(`/api/analysis-records/${record.id}`, { method: 'DELETE' })
      if (res.status === 401) {
        const redirectUrl = `/login?redirect=${encodeURIComponent('/analyze')}`
        window.location.href = redirectUrl
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || `刪除失敗 (HTTP ${res.status})`)
        return
      }
      if (selectedRecordId === record.id) {
        setAnalysis(null)
        setSelectedRecordId(null)
      }
      fetchHistory()
    } catch (e: any) {
      setError(e.message)
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
          <div className="text-lg font-semibold">{enabledAgents.length}/8 agents</div>
        </div>
        <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-white/5">
          <Clock className="w-5 h-5 text-[var(--accent)] mb-2" />
          <div className="text-sm text-[var(--text-secondary)]">Est. time</div>
          <div className="text-lg font-semibold">3-5 min</div>
        </div>
      </div>

      <SearchBar onSearch={handleAnalyze} loading={loading} />

      <AnalysisOptions
        language={language}
        onLanguageChange={setLanguage}
        enabledAgents={enabledAgents}
        onToggleAgent={handleToggleAgent}
        onToggleAll={handleToggleAll}
        disabled={loading}
      />

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {loading && (
          <div className="lg:col-span-1">
            <ProgressPanel progress={progress} enabledAgents={enabledAgents} />
          </div>
        )}

        <div className={loading ? 'lg:col-span-2' : 'lg:col-span-3'}>
          {loading && (
            <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-white/5 mb-6">
              {retryCountdown !== null ? (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                    <span className="text-sm font-medium text-amber-400">
                      Rate limited, retrying in {retryCountdown}s...
                    </span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5 mt-2">
                    <div
                      className="bg-amber-400 h-1.5 rounded-full transition-all duration-1000"
                      style={{ width: `${(retryCountdown / (retryCountdown + 1)) * 100}%` }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 bg-[var(--accent)] rounded-full animate-pulse" />
                    <span className="text-sm font-medium">
                      Running analysis... ({minutes}:{String(seconds).padStart(2, '0')})
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    Running 8 AI agents sequentially via OpenCode LLM models
                  </div>
                </>
              )}
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
            {historyRecords.map(record => {
              const recordTokens = getRecordTokens(record)
              return (
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
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="whitespace-nowrap">{record.created_at}</span>
                    {recordTokens !== null && (
                      <span
                        className="inline-flex items-center gap-1 whitespace-nowrap text-[var(--accent)]"
                        title="本次分析消耗的 token 數"
                      >
                        <Zap className="w-3 h-3" />
                        {recordTokens.toLocaleString()} tokens
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteRecord(record)
                        }}
                        className="flex items-center gap-1 text-rose-400/80 hover:text-rose-400 transition-colors"
                        title="刪除此筆分析紀錄（管理者）"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>刪除</span>
                      </button>
                    )}
                    <span className="flex items-center gap-0.5 text-[var(--accent)] hover:underline whitespace-nowrap">
                      查看完整報告 <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </div>
              )
            })}
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
