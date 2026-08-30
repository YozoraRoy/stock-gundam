import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '隱私權政策 | Stock Gundam',
  description: 'Stock Gundam 隱私權政策',
}

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">隱私權政策</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-8">生效日期：2026 年 8 月 30 日</p>

      <div className="prose prose-invert max-w-none text-sm">
        <h2>1. 我們收集的資料</h2>
        <p>
          當您使用 Google 或 LINE 帳號登入時，我們會取得您的電子郵件、顯示名稱與頭像等基本資料，用於建立與識別您的帳號。
          您提交的股票代號與分析請求，會由我們串接的 AI 服務進行處理。
        </p>

        <h2>2. 資料的使用</h2>
        <p>我們使用您的資料僅為下列目的：</p>
        <ul>
          <li>提供登入服務與帳號識別</li>
          <li>計算並管理您的每日 AI 分析額度</li>
          <li>儲存與展示您的歷史分析紀錄</li>
          <li>改善服務品質與除錯</li>
        </ul>

        <h2>3. 資料的分享</h2>
        <p>
          除下列情形外，我們不會將您的個人資料出售、出租或分享給第三方：
        </p>
        <ul>
          <li>您提交分析請求時，必要的 AI 服務供應商（僅傳送請求內容，不含您的登入個資）</li>
          <li>法律要求或為保護本服務權利之必要情形</li>
        </ul>

        <h2>4. 資料的保存與刪除</h2>
        <p>
          您的帳號與分析紀錄會保存於我們所託管的資料庫中。您可以隨時透過登入後的使用者選單提出帳號刪除要求，
          我們會在合理期間內刪除您的個人資料與分析紀錄。
        </p>

        <h2>5. Cookie 與 Session</h2>
        <p>
          我們使用 HTTP-only Cookie 存儲登入 Session（JWT）與 OAuth 驗證所需之暫存資料，以維持您的登入狀態並防止偽造請求。
          我們不使用第三方廣告 Cookie。
        </p>

        <h2>6. 未成年人</h2>
        <p>本服務不針對未成年人設計，若您未滿 18 歲，請在法定代理人同意下使用。</p>

        <h2>7. 政策變更</h2>
        <p>
          我們可能會不時更新本政策，更新後會於本頁公布。重大變更時，我們會透過郵件或站內公告通知您。
        </p>

        <h2>8. 聯絡我們</h2>
        <p>若您對本政策有任何疑問，請透過<a href="mailto:yuzora@example.com">此信箱</a>與我們聯絡。</p>
      </div>
    </main>
  )
}