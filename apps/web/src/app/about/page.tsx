import Link from 'next/link'
import { Search, PieChart, Wallet, Activity, TrendingUp, Clock } from 'lucide-react'

export const metadata = {
  title: '關於我們 — Stock Gundam',
}

const steps = [
  {
    icon: PieChart,
    title: '先從「零股 1 股」開始累積',
    desc: '低門檻買 1 股就能開始，還能趁股東會領划算的紀念品——小資金也能換來生活的小確幸。',
    href: '/odd-lot',
    cta: '看零股情報',
  },
  {
    icon: Activity,
    title: '用「季線乖離」找時機',
    desc: '不追高、不恐慌，用一個簡單指標判斷現在是不是相對適合進場的點。',
    href: '/backtest',
    cta: '跑回測模型',
  },
  {
    icon: Wallet,
    title: '用「損益追蹤」守紀律',
    desc: '把每次成本與損益記下來，靠數據檢討、不靠感覺，讓決策可以複製。',
    href: '/portfolio',
    cta: '試算損益',
  },
]

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-8">關於 Stock Gundam</h1>
      <div className="prose prose-invert max-w-none space-y-8 text-sm text-[var(--text-secondary)] leading-relaxed">
        <section>
          <p>
            Stock Gundam 不是「報明牌」的工具，而是一個陪你把錢慢慢變大的夥伴。我們相信：真正的財富成長，
            來自於<span className="text-[var(--text-primary)] font-medium">簡單、可重複的指標</span>、
            <span className="text-[var(--text-primary)] font-medium">紀律</span>與
            <span className="text-[var(--text-primary)] font-medium">時間的複利</span>——而不是追求一夜暴富。
          </p>
          <p>
            所以我們把複雜的市場，化約成一般人看得懂的訊號與指標，讓每個人都能做出有依據、能長期執行的投資決定。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">核心方法：一個指標，一個行動</h2>
          <p className="mb-4">我們相信「簡單才有紀律，紀律才走得遠」。每項功能都對應一個好懂的指標與下一步行動：</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-[var(--text-primary)]">季線乖離率</strong> — 判斷現在是不是相對適合進場的時機（<Link href="/backtest" className="text-[var(--accent)] hover:underline">週期進場模型</Link>）。</li>
            <li><strong className="text-[var(--text-primary)]">零股小額</strong> — 用「1 股」低門檻開始累積，還能趁股東會領取划算的紀念品，小資金也能換來生活的小確幸（<Link href="/odd-lot" className="text-[var(--accent)] hover:underline">零股情報</Link>）。</li>
            <li><strong className="text-[var(--text-primary)]">損益與成本追蹤</strong> — 用紀錄代替感覺，把決策變成可複製的方法（<Link href="/portfolio" className="text-[var(--accent)] hover:underline">損益試算</Link>）。</li>
            <li><strong className="text-[var(--text-primary)]">多維度 AI 分析</strong> — 補齊資訊落差，做出有依據的決定（<Link href="/analyze" className="text-[var(--accent)] hover:underline">AI 智能分析</Link>）。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">核心功能</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-[var(--text-primary)]">AI 智能分析</strong> — 多維度分析（市場、情緒、新聞、基本面），由多個 AI Agent 各司其職，幫你把資訊落差補齊。</li>
            <li><strong className="text-[var(--text-primary)]">零股情報</strong> — 台灣證交所零股成交即時行情，低門檻買 1 股就能開始累積，還能留意各家股東會的划算紀念品，為生活添點小確幸。</li>
            <li><strong className="text-[var(--text-primary)]">個人損益試算</strong> — 上傳券商持股截圖，AI 自動辨識並試算損益，套用投資法則取得建議，把持倉與決策記下來。</li>
            <li><strong className="text-[var(--text-primary)]">週期進場模型</strong> — 以季線乖離率做歷史回測，掃描各閾值勝率，用一個數字輔助判斷進場時機。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">如何開始：讓財富慢慢成長</h2>
          <div className="not-prose grid grid-cols-1 md:grid-cols-3 gap-4">
            {steps.map((s, i) => (
              <div key={s.title} className="relative flex flex-col bg-[var(--bg-card)] rounded-xl p-5 border border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <s.icon className="w-6 h-6 text-[var(--accent)]" />
                  <span className="text-xs font-bold text-[var(--accent)]">STEP {i + 1}</span>
                </div>
                <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1.5">{s.title}</h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-4 flex-1">{s.desc}</p>
                <Link
                  href={s.href}
                  className="inline-flex items-center justify-center text-center rounded-lg bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 border border-[var(--accent)]/30 text-[var(--accent)] text-sm font-medium px-3 py-2 transition"
                >
                  {s.cta}
                </Link>
                {i < steps.length - 1 && (
                  <div className="hidden md:flex absolute top-1/2 -right-4 -translate-y-1/2 text-[var(--text-secondary)] z-10">
                    <span className="text-lg font-bold">→</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="mt-5 flex items-center gap-2 text-[var(--text-primary)]">
            <TrendingUp className="w-4 h-4 text-[var(--accent)]" />
            複利，來自於重複做對的簡單事情。
            <Clock className="w-4 h-4 ml-2 text-[var(--accent)]" />
            給自己時間，投資也是。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">技術架構</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>前端：Next.js 15 + React + Tailwind CSS</li>
            <li>後端：Node.js + SQLite / Azure SQL</li>
            <li>AI：Google Gemini、OpenAI 相容端點</li>
            <li>數據：TWSE OpenAPI、Yahoo Finance API</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">開源</h2>
          <p>
            本專案原始碼公開於 <a href="https://github.com/YozoraRoy/stock-gundam" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">GitHub</a>，歡迎回饋與貢獻。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">免責聲明</h2>
          <p>
            本平台所顯示之指標與分析結果僅供參考，不構成投資推薦。任何投資皆有風險，投資決策需自行判斷，本平台不對任何損失負責。
          </p>
        </section>
      </div>
      <div className="mt-8">
        <Link href="/" className="text-sm text-[var(--accent)] hover:underline">
          ← 返回首頁
        </Link>
      </div>
    </div>
  )
}
