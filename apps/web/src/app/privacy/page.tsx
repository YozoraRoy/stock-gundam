import Link from 'next/link'

export const metadata = {
  title: '隱私權政策 — Stock Gundam',
}

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-8">隱私權政策</h1>
      <div className="prose prose-invert max-w-none space-y-6 text-sm text-[var(--text-secondary)] leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">一、資料收集</h2>
          <p>
            Stock Gundam（以下簡稱「本平台」）透過 OAuth 第三方登入（Google、GitHub）取得您的顯示名稱與電子郵件地址，作為帳號識別之用。本平台不會收集或儲存您的密碼。
          </p>
          <p>
            當您使用圖片辨識功能時，上傳的圖片會傳送至第三方 AI 服務（Google Gemini 或 OpenAI 相容端點）進行辨識，處理完成後不會永久留存原始圖片。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">二、資料使用</h2>
          <p>
            您的帳號資訊僅用於登入驗證與服務配額管理。本平台不會將您的個人資料出售、出租或以其他方式提供予第三方，但以下情形除外：
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>依法令或主管機關要求。</li>
            <li>為維護本平台之安全與合法運作。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">三、資料儲存與安全</h2>
          <p>
            帳號資料與分析紀錄儲存於本平台之資料庫。我們採用合理之技術與管理措施保護您的資料免於未經授權之存取、使用或洩漏。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">四、第三方服務</h2>
          <p>
            本平台使用 Yahoo Finance API（市場數據）、TWSE/TPEx（證交所公開資訊）及第三方 AI 模型服務。這些第三方服務有其獨立的 Privacy Policy，使用本平台即表示您同意相關數據依各服務之政策處理。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">五、Cookie</h2>
          <p>
            本平台使用 HTTP-only Cookie 進行登入狀態管理，不會使用廣告或追蹤類 Cookie。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">六、您的權利</h2>
          <p>
            您可隨時要求查閱、更正或刪除您的帳號資料。如需行使相關權利，請透過 GitHub Issues 聯絡我們。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">七、政策更新</h2>
          <p>
            本隱私權政策可能不時更新，更新後將於本頁發布，並自發布時起生效。
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