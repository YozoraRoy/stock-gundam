'use client'

import { useState } from 'react'
import { Settings2, HelpCircle, Languages, Check } from 'lucide-react'
import {
  AGENT_KEYS,
  ANALYSIS_LANGUAGE_OPTIONS,
  type AnalysisLanguage,
} from '@stock/core'

interface AgentMeta {
  key: string
  name: { zh: string; en: string }
  role: { zh: string; en: string }
  detail: { zh: string; en: string }
  model: 'deep' | 'quick'
}

const AGENT_META: AgentMeta[] = [
  {
    key: 'Market Analyst',
    name: { zh: '技術分析', en: 'Market Analyst' },
    role: { zh: '分析價格走勢、趨勢與技術指標', en: 'Analyzes price action, trends, and technical indicators' },
    detail: {
      zh: '產出 K 線型態、支撐/壓力位、成交量變化與技術指標報告，給交易者具體進出場參考。',
      en: 'Produces a technical report covering formations, support/resistance, volume patterns, and actionable insights for traders.',
    },
    model: 'quick',
  },
  {
    key: 'Sentiment Analyst',
    name: { zh: '市場情緒', en: 'Sentiment Analyst' },
    role: { zh: '分析市場情緒方向與熱度', en: 'Analyzes market sentiment direction and heat' },
    detail: {
      zh: '從社群與新聞輿論判斷 Bullish/Bearish/Neutral，給予 0-10 情緒分數、信心度與主導敘事主題。',
      en: 'Judges Bullish/Bearish/Neutral direction from social media and news, with a 0-10 sentiment score, confidence level, and narrative themes.',
    },
    model: 'quick',
  },
  {
    key: 'News Analyst',
    name: { zh: '新聞與總經', en: 'News Analyst' },
    role: { zh: '掃描公司新聞與總體經濟', en: 'Scans company news and macroeconomics' },
    detail: {
      zh: '涵蓋公司消息、產業動態、總體經濟指標、地緣政治與內部人交易，找出關鍵催化劑與風險。',
      en: 'Covers company news, sector developments, macro indicators, geopolitics, and insider transactions to surface catalysts and risks.',
    },
    model: 'quick',
  },
  {
    key: 'Fundamentals Analyst',
    name: { zh: '基本面', en: 'Fundamentals Analyst' },
    role: { zh: '檢視財報與估值指標', en: 'Reviews financials and valuation metrics' },
    detail: {
      zh: '分析營收成長、獲利能力、資產負債表健康度、現金流與 PE/PB/PEG/EV/EBITDA 估值，並評估護城河與財務風險。',
      en: 'Analyzes revenue growth, profitability, balance-sheet health, cash flow, valuation metrics (PE/PB/PEG/EV/EBITDA), moat, and financial risks.',
    },
    model: 'quick',
  },
  {
    key: 'Bull Researcher',
    name: { zh: '多方研究', en: 'Bull Researcher' },
    role: { zh: '從多方角度提出看多論述', en: 'Builds the bull case for the stock' },
    detail: {
      zh: '站在多方立場，針對空方擔憂逐一回應，聚焦成長潛力、競爭優勢與正面催化劑。',
      en: 'Advocates for investment, addressing bear concerns with growth potential, competitive advantages, and positive catalysts.',
    },
    model: 'quick',
  },
  {
    key: 'Research Manager',
    name: { zh: '研究總結', en: 'Research Manager' },
    role: { zh: '綜整多空辯論產出評級', en: 'Synthesizes the debate into a rating' },
    detail: {
      zh: '綜合各分析師報告與多空辯論，產出 Buy / Overweight / Hold / Underweight / Sell 評級、投資理由與策略行動清單。',
      en: 'Synthesizes analyst reports and the bull/bear debate into a rating, rationale, and strategic action list.',
    },
    model: 'deep',
  },
  {
    key: 'Trader',
    name: { zh: '交易計畫', en: 'Trader' },
    role: { zh: '轉成具體交易提案', en: 'Converts plans into trade orders' },
    detail: {
      zh: '把研究結論轉為具體動作：Buy/Hold/Sell、進場價、停損價、區分階段建倉與風險佔比。',
      en: 'Turns the plan into specific actions: Buy/Hold/Sell, entry price, stop loss, phased entry, and position sizing.',
    },
    model: 'quick',
  },
  {
    key: 'Portfolio Manager',
    name: { zh: '最終決策', en: 'Portfolio Manager' },
    role: { zh: '做成最終投資決策', en: 'Makes the final investment decision' },
    detail: {
      zh: '綜合風險辯論與過去交易教訓，產出最終評級、投資論述、目標價與時間跨度。',
      en: 'Combines the risk debate and past lessons into the final rating, investment thesis, price target, and time horizon.',
    },
    model: 'deep',
  },
]

interface AnalysisOptionsProps {
  language: AnalysisLanguage
  onLanguageChange: (language: AnalysisLanguage) => void
  enabledAgents: string[]
  onToggleAgent: (key: string) => void
  onToggleAll: (enabled: boolean) => void
  disabled?: boolean
}

function AgentTooltip({ meta, language }: { meta: AgentMeta; language: AnalysisLanguage }) {
  const usedLanguage = language === 'zh-TW'
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Agent 說明"
        className="w-5 h-5 rounded-full bg-white/10 hover:bg-[var(--accent)]/30 text-[var(--text-secondary)] hover:text-white
                   flex items-center justify-center text-xs font-semibold transition-colors"
      >
        ?
      </button>
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 z-30 opacity-0 group-hover/agent:opacity-100 transition-opacity duration-150">
        <div className="bg-[#1a1d24] border border-white/10 rounded-xl px-4 py-3 shadow-2xl">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-sm font-semibold text-white">
              {usedLanguage ? meta.name.zh : meta.name.en}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
              meta.model === 'deep'
                ? 'bg-purple-500/15 text-purple-300 border border-purple-500/20'
                : 'bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20'
            }`}>
              {meta.model}
            </span>
          </div>
          <p className="text-xs font-medium text-[var(--accent)] mb-1">
            {usedLanguage ? meta.role.zh : meta.role.en}
          </p>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            {usedLanguage ? meta.detail.zh : meta.detail.en}
          </p>
        </div>
      </div>
    </div>
  )
}

export function AnalysisOptions({
  language,
  onLanguageChange,
  enabledAgents,
  onToggleAgent,
  onToggleAll,
  disabled,
}: AnalysisOptionsProps) {
  const [expanded, setExpanded] = useState(true)
  const isZh = language === 'zh-TW'
  const enabledSet = new Set(enabledAgents)
  const allEnabled = AGENT_KEYS.every(k => enabledSet.has(k))

  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-white/10 mt-4">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-[var(--accent)]" />
          <span className="text-sm font-semibold">
            {isZh ? 'AI 分析設定' : 'AI Analysis Settings'}
          </span>
          {!allEnabled && !disabled && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
              {isZh ? `${enabledAgents.length}/${AGENT_KEYS.length} 個 Agent 啟用` : `${enabledAgents.length}/${AGENT_KEYS.length} agents enabled`}
            </span>
          )}
        </div>
        <span className={`text-[var(--text-secondary)] text-xs transition-transform ${expanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-white/5 pt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <Languages className="w-3.5 h-3.5" />
              <span>{isZh ? '報告語言' : 'Report language'}</span>
            </div>
            <div className="flex rounded-lg border border-white/10 overflow-hidden">
              {ANALYSIS_LANGUAGE_OPTIONS.map(opt => {
                const active = language === opt.id
                const label = isZh ? opt.label : (opt.id === 'en' ? 'English' : 'Traditional Chinese')
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => onLanguageChange(opt.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? 'bg-[var(--accent)] text-white'
                        : 'text-[var(--text-secondary)] hover:text-white hover:bg-white/5'
                    } disabled:opacity-50`}
                  >
                    {active && <Check className="w-3 h-3" />}
                    {label}
                  </button>
                )
              })}
            </div>
            {language === 'zh-TW' && (
              <span className="text-[10px] text-[var(--text-secondary)]">
                {isZh ? '（貨幣一律以新台幣 NTD 計算）' : '(currency in NTD)'}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{isZh ? '啟用個別 Agent（可視需求單獨執行）' : 'Enable individual agents (run separately on demand)'}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={disabled || allEnabled}
                onClick={() => onToggleAll(true)}
                className="text-[11px] px-2.5 py-1 rounded-lg border border-white/10 text-[var(--text-secondary)] hover:text-white hover:bg-white/5 transition disabled:opacity-40"
              >
                {isZh ? '全部啟用' : 'Enable all'}
              </button>
              <button
                type="button"
                disabled={disabled || !allEnabled}
                onClick={() => onToggleAll(false)}
                className="text-[11px] px-2.5 py-1 rounded-lg border border-white/10 text-[var(--text-secondary)] hover:text-white hover:bg-white/5 transition disabled:opacity-40"
              >
                {isZh ? '全部停用' : 'Disable all'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {AGENT_META.map(meta => {
              const enabled = enabledSet.has(meta.key)
              return (
                <div
                  key={meta.key}
                  className={`group/agent flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-colors ${
                    enabled
                      ? 'border-[var(--accent)]/30 bg-[var(--accent)]/5'
                      : 'border-white/10 bg-transparent opacity-60'
                  }`}
                >
                  <button
                    type="button"
                    disabled={disabled}
                    role="switch"
                    aria-checked={enabled}
                    onClick={() => onToggleAgent(meta.key)}
                    className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
                      enabled ? 'bg-[var(--accent)]' : 'bg-white/15'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        enabled ? 'left-[18px]' : 'left-0.5'
                      }`}
                    />
                  </button>
                  <span className="text-xs font-medium flex-1 min-w-0 truncate">
                    {isZh ? meta.name.zh : meta.name.en}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono shrink-0 ${
                    meta.model === 'deep'
                      ? 'bg-purple-500/15 text-purple-300 border border-purple-500/20'
                      : 'bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20'
                  }`}>
                    {meta.model}
                  </span>
                  <AgentTooltip meta={meta} language={language} />
                </div>
              )
            })}
          </div>

          {enabledAgents.length === 0 && (
            <p className="text-[11px] text-amber-400">
              {isZh ? '⚠️ 至少須啟用一個 Agent 才能開始分析。' : '⚠️ At least one agent must be enabled to start an analysis.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}