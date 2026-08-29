# Google / LINE 登入申請設定（OAuth）

> 目的：讓「Google 登入」與「LINE 登入」可以運作。需要到兩官方平台各建立一個 OAuth 應用程式，取得 **Client ID + Client Secret**，再加上自行產生的 **AUTH_SECRET**（JWT session 簽章密鑰）。
>
> 對應程式碼讀取的環境變數：`apps/web/src/lib/oauth.ts`、`apps/web/src/lib/auth.ts`

---

## 需要的密鑰一覽

| 環境變數 | 來源 | 用途 |
|----------|------|------|
| `GOOGLE_CLIENT_ID` | Google Cloud Console | Google 登入的 client id |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console | Google 登入的 client secret |
| `LINE_CLIENT_ID` | LINE Developers | LINE 登入的 Channel ID（當 client id） |
| `LINE_CLIENT_SECRET` | LINE Developers | LINE 登入的 Channel Secret（當 client secret） |
| `AUTH_SECRET` | 自己產生 | 簽署登入 session JWT，**禁止進 repo** |
| `AUTH_BASE_URL` | 固定值 | callback 網址用的 base（部署時寫死，不需設 secret） |

> **安全性**：`CLIENT_SECRET` 與 `AUTH_SECRET` 只放本機 `.env.local`、GitHub Secret、Azure App Settings。**絕不可 commit 進 repo。**

---

## 1. Google 登入（Google Cloud Console）

1. 進 [Google Cloud Console](https://console.cloud.google.com) → 選（或建立）你的專案。
2. 選單 **APIs & Services → Credentials** → **Create Credentials → OAuth client ID**。
3. Application type 選 **Web application**。
4. 在 **Authorized redirect URIs** 加入 callback 網址（`/api/auth/callback/google` 結尾）：
   - 本機：`http://localhost:3000/api/auth/callback/google`
   - 線上：`https://<你的網域名>.azurewebsites.net/api/auth/callback/google`
5. 建立後記下 **Client ID** 與 **Client Secret**。

> 若 OK 畫面蘭第三方帳號，需把 OAuth consent screen 的測試狀態設為 published。

---

## 2. LINE 登入（LINE Developers）

> ⚠️ **LINE 禁止 localhost / 私有 IP 作為 redirect URI**，只能填 https，因此 Line 無法在本機直接測。本機測額度流程請改用 `/api/auth/dev-login`（僅非 production 提供）。

1. 到 [LINE Developers](https://developers.line.biz)：
   - 使用 LINE 帳號登入 → 建立一個 **Provider** → **Create a LINE Login channel**。
2. 填基本資訊後，進入 channel 的 **LINE Login → Settings**。
3. 在 **Redirect URI** 加入線上 callback：
   - `https://<stock-app名>.azurewebsites.net/api/auth/callback/line`
4. 記下 **Channel ID**（當 client id）與 **Channel Secret**（當 client secret）。
5. （選擇性）若要取得 user email：在 channel 開 **email permission** 並送審；MVP 未開也能登入（email 為 NULL）。

> 相關 code：Scope 用 `openid profile`，profile 抓 `https://api.line.me/v2/profile`（無 email）。

---

## 4. AUTH_SECRET（共用，自行產生）

不來自任何平台，純粹是簽章密鑰，用以下指令產生：

```bash
openssl rand -base64 32
# 例如：gQ7Y... 一串隨機 base64
```

只填入 `.env.local`／GitHub Secret／Azure App Settings。

---

## 依執行階段需要申請的項目

| 來源 | 本機開發 | 上線 |
|------|----------|------|
| Google Client ID / Secret | ✅（callback 加 localhost） | ✅ |
| LINE Client ID / Secret | ❌（LINE 禁 localhost，用 dev-login 測） | ✅ |
| AUTH_SECRET | ✅ | ✅ |
| AUTH_BASE_URL | 可略或填 `http://localhost:3000` | ✅ 固定寫死線上網址 |

---

## 設定位置

- 本機開發：`apps/web/.env.local`（參考根目錄 `.env.example`）
- 上線 CI：`.github/workflows/deploy.yml` 會把 GitHub Secrets 寫入 Azure App Settings

---

## 常見問題

### provider not configured（登入 503）
代表該 provider 的 `CLIENT_ID`／`CLIENT_SECRET` 沒有都設定，`oauth.ts` 的 `isProviderConfigured()` 不會通過。檢查對應環境變數是否齊全。

### LINE 無法本機測
LINE 不允許 localhost callback，請用 `/api/auth/dev-login` 或先在線上驗證 LINE。