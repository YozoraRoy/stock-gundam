import Link from 'next/link'

export const metadata = {
  title: '服務條款 — Vestential',
}

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-8">服務條款</h1>
      <div className="prose prose-invert max-w-none space-y-6 text-sm text-[var(--text-secondary)] leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">一、服務說明</h2>
          <p>
            Vestential（以下簡稱「本平台」）提供 AI 股票分析、零股行情查詢、個人損益試算與歷史回測等功能，旨在作為投資研究輔助工具。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">二、免責聲明</h2>
          <p className="text-[var(--accent-red)]">
            ⚠ 本平台所顯示之一切資訊、分析結果與建議，僅供參考，不構成任何投資推薦或財務建議。
          </p>
          <p>
            股市投資具有風險，過去之績效不代表未來表現。您應自行判斷投資決策，本平台不對因使用本平台資訊所導致之任何損失承擔責任。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">三、使用者行為</h2>
          <p>使用本平台時，您同意：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>不以自動化方式大量抓取或複製本平台內容。</li>
            <li>不嘗試繞過配額限制或存取控制。</li>
            <li>不將本平台服務用於任何非法目的。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">四、帳號與配額</h2>
          <p>
            本平台提供每日免費 AI 分析額度，額度用盡後需隔日重置。本平台保留調整配額之權利，恕不另行通知。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">五、智慧財產權</h2>
          <p>
            本平台之程式碼、介面設計與文字內容之著作權歸本平台所有。市場數據來自各證券交易所之公開資訊及第三方 API，相關商標與版權歸原權利人所有。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">六、條款修訂</h2>
          <p>
            本平台保留隨時修改本服務條款之權利，修改後將於本頁發布。繼續使用本平台即視為您同意修改後之條款。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">七、聯絡方式</h2>
          <p>
            如有疑問，請至 <a href="https://github.com/YozoraRoy/vestential/issues" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">GitHub Issues</a> 提出。
          </p>
        </section>

        <p className="text-[var(--text-secondary)] pt-4">最後更新：2026 年 9 月</p>
      </div>
      <div className="mt-8">
        <Link href="/" className="text-sm text-[var(--accent)] hover:underline">
          ← 返回首頁
        </Link>
      </div>
    </div>
  )
}