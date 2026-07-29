import { useMemo } from 'react'
import {
  TrendingUp, AlertTriangle, Newspaper, BarChart3,
  ThumbsUp, ClipboardList, ShoppingCart, Briefcase,
  LucideIcon,
} from 'lucide-react'

const STEPS = [
  { key: 'Market Analyst', label: '市場技術分析', icon: TrendingUp },
  { key: 'Sentiment Analyst', label: '市場情緒分析', icon: AlertTriangle },
  { key: 'News Analyst', label: '新聞與總經分析', icon: Newspaper },
  { key: 'Fundamentals Analyst', label: '基本面分析', icon: BarChart3 },
  { key: 'Bull Researcher', label: '多方研究', icon: ThumbsUp },
  { key: 'Research Manager', label: '研究總結', icon: ClipboardList },
  { key: 'Trader', label: '交易提案', icon: ShoppingCart },
  { key: 'Portfolio Manager', label: '最終決策', icon: Briefcase },
] as const

interface ProgressPanelProps {
  progress: { step: string; detail: string }[]
}

export function ProgressPanel({ progress }: ProgressPanelProps) {
  const lastEvent = progress[progress.length - 1]
  const currentStep = lastEvent?.detail === 'running...' ? lastEvent.step : null

  const completed = new Set(
    progress.filter(e => e.detail === 'done').map(e => e.step),
  )

  const visible = useMemo(() => {
    const currentIdx = currentStep
      ? STEPS.findIndex(s => s.key === currentStep)
      : STEPS.length - 1
    const start = Math.max(0, currentIdx - 4)
    return STEPS.slice(start, currentIdx + 1)
  }, [currentStep])

  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-white/5 p-5 space-y-3">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
        Analysis Progress
      </h3>
      <div className="space-y-2">
        {STEPS.map(({ key, label, icon: Icon }) => {
          const isDone = completed.has(key)
          const isCurrent = key === currentStep

          if (!isDone && !isCurrent && completed.size === 0) {
            return null
          }

          return (
            <div
              key={key}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300 ${
                isCurrent
                  ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/20'
                  : isDone
                    ? 'opacity-80'
                    : 'opacity-40'
              }`}
            >
              <div className="relative w-5 h-5 flex items-center justify-center">
                {isCurrent ? (
                  <div className="w-2 h-2 bg-[var(--accent)] rounded-full animate-pulse" />
                ) : isDone ? (
                  <svg className="w-4 h-4 text-[var(--accent-green)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <div className="w-1.5 h-1.5 bg-[var(--text-secondary)] rounded-full" />
                )}
              </div>
              <Icon className={`w-4 h-4 ${isCurrent ? 'text-[var(--accent)]' : ''}`} />
              <span className={`text-sm ${isCurrent ? 'font-semibold text-[var(--accent)]' : ''}`}>
                {label}
              </span>
              {isCurrent && (
                <span className="text-xs text-[var(--accent)] ml-auto animate-pulse">
                  Analyzing...
                </span>
              )}
              {isDone && (
                <span className="text-xs text-[var(--accent-green)] ml-auto">
                  Done
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
