import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '服務條款 | Stock Gundam',
  description: 'Stock Gundam 服務條款',
}

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">服務條款</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-8">生效日期：2026 年 8 月 30 日</p>

      <div className="prose prose-invert max-w-none text-sm">
        <h2>1. 接受條款</h2>
        <p>
          使用 Stock Gundam（以下稱「本服務」）即表示您同意本服務條款。若您不同意，請勿使用本服務。
        </p>

        <h2>2. 服務說明</h2>
        <p>
          本服務為股票相關資訊的 AI 輔助分析工具，可針對您輸入的股票代號提供技術面、基本面與市場等面向的分析摘要。
        </p>

        <h2>3. 非投資建議</h2>
        <p className="font-medium text-[var(--accent-red)]">
          本服務的分析結果僅供參考，不構成任何投資建議、要約或推薦。股市投資具有風險，
          您應自行評估並承受所有投資決策之風險與後果，本服務不對任何投資損益負責。
        </p>

        <h2>4. AI 分析的限制</h2>
        <ul>
          <li>分析內容由 AI 模型產生，可能不精確或過時，請自行查證原始公開資訊。</li>
          <li>AI 分析可能出現錯誤（hallucination），請勿僅憑分析結果進行交易。</li>
          <li>本服務不保證分析內容的即時性、完整性或正確性。</li>
        </ul>

        <h2>5. 額度與使用規範</h2>
        <p>
          已登入使用者每日享有有限的 AI 分析額度。我們保留調整額度、限制或停止服務之權利。
          嚴禁以任何形式濫用本服務，包括但不限於自動化大量請求、規避額度、破壞服務等行為。
        </p>

        <h2>6. 帳號</h2>
        <p>
          您對帳號下的所有活動負責。若發現未經授權的使用，請立即通知我們。
          我們保留在違反本條款時暫停或終止帳號之權利。
        </p>

        <h2>7. 服務可用性</h2>
        <p>
          本服務可能因維護、系統故障、第三方服務（含 AI 供應商）中斷而暫時無法使用，
          我們不保證服務不中斷或無錯誤。
        </p>

        <h2>8. 責任限制</h2>
        <p>
          在法律允許的最大範圍內，本服務對任何直接、間接、附帶、衍生或懲罰性損害不負責任，
          包含因使用或無法使用本服務所生之損失。
        </p>

        <h2>9. 條款變更</h2>
        <p>我們可能會不定期更新本條款，更新後於本頁公布。繼續使用本服務即視為接受更新後的條款。</p>

        <h2>10. 準據法</h2>
        <p>本條款以中華民國法律為準據法。</p>
      </div>
    </main>
  )
}