import Link from 'next/link'

export const metadata = {
  title: '關於我們 — Stock Gundam',
}

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-8">關於 Stock Gundam</h1>
      <div className="prose prose-invert max-w-none space-y-6 text-sm text-[var(--text-secondary)] leading-relaxed">
        <section>
          <p>
            Stock Gundam 是一個以 AI 驅動的開源股票分析平台，整合即時市場數據與多智能體分析引擎，專注台股與美股研究。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">核心功能</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-[var(--text-primary)]">AI 智能分析</strong> — 多維度分析（市場、情緒、新聞、基本面），由多個 AI Agent 各司其職。</li>
            <li><strong className="text-[var(--text-primary)]">零股情報</strong> — 台灣證交所零股成交即時行情，支援歷史查詢。</li>
            <li><strong className="text-[var(--text-primary)]">個人損益試算</strong> — 上傳券商持股截圖，AI 自動辨識並試算損益，套用投資法則取得建議。</li>
            <li><strong className="text-[var(--text-primary)]">週期進場模型</strong> — 以季線乖離率做歷史回測，掃描各閾值勝率，輔助判斷進場時機。</li>
          </ul>
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
            本平台所顯示之分析結果與建議僅供參考，不構成投資推薦。投資決策需自行判斷，本平台不對任何損失負責。
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