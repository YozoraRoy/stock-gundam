import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { TrendingUp, AlertTriangle, Newspaper, BarChart3, Target } from 'lucide-react'

interface AnalysisCardProps {
  analysis: {
    signal: string
    decision: string
    reports: {
      market: string
      sentiment: string
      news: string
      fundamentals: string
    }
  }
}

const RATING_COLORS: Record<string, string> = {
  Buy: 'text-[var(--accent-green)]',
  Overweight: 'text-[var(--accent-green)]',
  Hold: 'text-yellow-400',
  Underweight: 'text-[var(--accent-red)]',
  Sell: 'text-[var(--accent-red)]',
}

const RATING_BG: Record<string, string> = {
  Buy: 'bg-[var(--accent-green)]/10 border-[var(--accent-green)]/20',
  Overweight: 'bg-[var(--accent-green)]/10 border-[var(--accent-green)]/20',
  Hold: 'bg-yellow-400/10 border-yellow-400/20',
  Underweight: 'bg-[var(--accent-red)]/10 border-[var(--accent-red)]/20',
  Sell: 'bg-[var(--accent-red)]/10 border-[var(--accent-red)]/20',
}

const sections = [
  { key: 'market' as const, label: '技術分析', icon: TrendingUp, color: 'text-[var(--accent)]' },
  { key: 'sentiment' as const, label: '市場情緒', icon: AlertTriangle, color: 'text-yellow-400' },
  { key: 'news' as const, label: '新聞與總經', icon: Newspaper, color: 'text-[var(--accent)]' },
  { key: 'fundamentals' as const, label: '基本面', icon: BarChart3, color: 'text-[var(--accent-green)]' },
]

export function AnalysisCard({ analysis }: AnalysisCardProps) {
  const color = RATING_COLORS[analysis.signal] ?? 'text-[var(--text-primary)]'
  const bg = RATING_BG[analysis.signal] ?? 'bg-[var(--bg-card)]'

  return (
    <div className="mt-8 space-y-6">
      <div className={`${bg} rounded-xl p-6 border`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            <h2 className="text-lg font-semibold">綜合評級</h2>
          </div>
          <span className={`text-2xl font-bold ${color}`}>{analysis.signal}</span>
        </div>
        <div className="prose prose-invert max-w-none text-sm">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {analysis.decision}
          </ReactMarkdown>
        </div>
      </div>

      {sections.map(({ key, label, icon: Icon, color: iconColor }) => {
        const content = analysis.reports[key]
        if (!content) return null

        return (
          <section key={key} className="bg-[var(--bg-card)] rounded-xl border border-white/5 overflow-hidden">
            <div className="flex items-center gap-3 px-6 pt-5 pb-3 border-b border-white/5">
              <Icon className={`w-5 h-5 ${iconColor}`} />
              <h3 className="text-base font-semibold">{label}</h3>
            </div>
            <div className="px-6 py-4 prose prose-invert max-w-none text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
          </section>
        )
      })}
    </div>
  )
}
