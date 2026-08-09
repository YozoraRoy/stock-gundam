# 規劃：註冊／登入 + AI 分析限額（10 次/日）

> 狀態：規劃文件（v1，2026-08-03）
> 範圍：`apps/web`（Next.js 15 App Router）+ `packages/database`

## 目標
- 使用 AI 分析前必須登入（OAuth 首次登入 = 自動註冊，無密碼註冊頁）
- Google 與 LINE 兩種登入方式
- 每帳號每天 **10 次** AI 分析額度（依台灣時間 Asia/Taipei 計算）
- 瀏覽分析紀錄**不需登入**（維持公開）

## 關鍵設計決定（預設推薦，可調整）
1. **客製 OAuth + JWT session**（新增唯一 runtime 依賴 `jose`），不引入 NextAuth — LINE OAuth 非標準 OIDC，客製流程最可控，且 Azure App Service 無狀態環境用 JWT cookie 最適合
2. **額度在分析開始時即扣除**（防鑽漏洞），失敗不退還
3. 同一人以 Google／LINE 各登入一次 → 視為兩個帳號（各自獨立 10 次額度）；後續可依 email 合併（見「後續優化」）

---

## Milestones

| # | Milestone | 目標 | 成功準則 |
|---|-----------|------|----------|
| 1 | 資料庫 + 認證基礎完成 | Day 2 | 新表建成、JWT 簽發/驗證、額度原子扣減測試通過 |
| 2 | OAuth 登入可運作 | Day 3 | 本機 mock 登入 + Google 本機回調可用 |
| 3 | 前端頁面整合完成 | Day 5 | /login 頁、Header 使用者選單、analyze 閘道 + 429 處理完成 |
| 4 | 上線（Azure + OAuth console） | Day 6 | 線上 Google/LINE 登入、額度正確、紀錄仍公開 |

---

## Phase 1：資料庫與認證基礎（S，1 天）

| 任務 | 工時 | 依賴 | 完成準則 |
|------|------|------|----------|
| `db.ts` 新增 3 張表（SQLite + Azure 雙路徑）：`users`、`user_identities`、`api_usage` | 3h | — | 兩端 `migrate()` 冪等可建 |
| DB helpers：`findOrCreateUser`、`getUserById`、`getQuota`、`consumeQuota`（原子 `UPDATE … SET count=count+1 WHERE count < 10`） | 3h | 上者 | 並發測試不超限 |
| 安裝 `jose`；`lib/auth.ts`：JWT sign/verify、httpOnly cookie 讀寫、`requireUser()` | 2h | — | 無效/過期 token 回 401 |

**Schema 重點**
```sql
users            (id, email, display_name, avatar_url, created_at)
user_identities  (id, user_id→users, provider['google'|'line'],
                  provider_user_id, provider_email, UNIQUE(provider, provider_user_id))
api_usage        (id, user_id→users, usage_date 'YYYY-MM-DD'(Asia/Taipei),
                  count, UNIQUE(user_id, usage_date))
```
> 新增表採 `db.ts` 內 `CREATE TABLE IF NOT EXISTS`（沿用現有模式），不走 `migrations/*.sql`（CREATE TABLE 雙語法不相容；migrations 目前只用於 ADD COLUMN 等兩端相容語句）。

---

## Phase 2：OAuth API（M，1.5 天）

| 任務 | 工時 | 依賴 | 完成準則 |
|------|------|------|----------|
| `lib/oauth.ts`：Google + LINE 的 authorize/token/profile 設定與實作 | 3h | — | 兩 provider 都能拿 profile |
| `GET /api/auth/login/[provider]`：帶 state+PKCE（S256，存 httpOnly cookie）導向 provider | 2h | oauth.ts | 正確 redirect |
| `GET /api/auth/callback/[provider]`：驗 state → 換 code → 取 profile → upsert 使用者 → 簽 JWT → 設 cookie → redirect 回原頁 | 4h | 上者 | 回跳正常、cookie httpOnly |
| `GET /api/auth/me`、`POST /api/auth/logout` | 1.5h | auth.ts | 回傳使用者+今日剩餘額度／清除 cookie |
| `GET /api/auth/dev-login`（僅 dev，供本機測額度流程） | 1h | 上者 | `NODE_ENV !== 'production'` 才可用 |

**OAuth 重點**
- Google：authorize 用 `openid email profile`；userinfo 用 `https://openidconnect.googleapis.com/v1/userinfo`
- LINE：`https://access.line.me/oauth2/v2.1/authorize`（scope `openid profile`）；profile 用 `https://api.line.me/v2/profile`（userId/displayName/pictureUrl，**無 email**，需容忍 email 為空）

---

## Phase 3：前端整合（M，1.5 天）

| 任務 | 工時 | 依賴 | 完成準則 |
|------|------|------|----------|
| `/login` 頁：Google／LINE 兩個大按鈕 + 額度說明 + `?redirect=` 回跳 | 4h | Phase 2 | 未登入可看到、已登入自動導向 analyze |
| Header 整合：未登入顯示「登入」；登入後顯示頭像/名稱 + 剩餘次數 + 登出 | 3h | me API | 狀態即時更新、無明顯閃爍 |
| analyze 頁閘道：`handleAnalyze` 收到 401 → 導向 /login?redirect=…；429 → 顯示「今日額度用完」 | 3h | Phase 2 | 未登入不能觸發 AI，但可看歷史 |

**閘道位置**：`/api/analyze` POST 在開啟 SSE 串流**之前**同步執行 `requireUser()`（401）+ `consumeQuota()`（429）；**401/429 一律回 JSON（非 SSE）**。前端 analyze/page.tsx:90 的 `res.ok` 分支已有現成處理點。

---

## Phase 4：設定與上線（S-M，1 天）

| 任務 | 工時 | 依賴 | 完成準則 |
|------|------|------|----------|
| Google Cloud Console：OAuth 用戶端，redirect 加本機（http://localhost） + Azure | 1h | — | 拿到 CLIENT_ID/SECRET |
| LINE Developers：Channel + OAuth，redirect 設 Azure https（LINE 不允許 localhost/私有 IP） | 1h | — | 拿到 Channel ID/Secret |
| env：`.env.example`、`apps/web/.env.local`、**deploy.yml 與 deploy.ps1** appsettings、GitHub Secrets（GOOGLE_CLIENT_ID/SECRET、LINE_CLIENT_ID/SECRET、AUTH_SECRET、AUTH_BASE_URL） | 1.5h | 上兩者 | 線上讀得到、密鑰不外洩 |
| 上線測試：Google 登入 → 額度扣減 → 第 11 次回 429 → 登出 → 紀錄仍公開 | 2h | 全部 | e2e 全過 |

---

## 計畫檢視：補漏清單（v1 檢視後新增）

原始計畫經重新檢視後，補充以下漏項：

1. **AI 入口確認（重要）**：全站唯一 AI 呼叫點為 `/api/analyze`（已 grep 驗證，analyze/page.tsx:83）。服務端閘道可一併覆蓋首頁/stock 頁未來可能加的分析按鈕，不需另做前端閘道。因此**不需 Next.js middleware**，用 route helper 即可。
2. **401/429 回覆格式**：必須在開啟 SSE 前同步回傳 **JSON**（`{ error, quota? }`），不可夾帶 SSE 格式，否則前端解析會壞。
3. **redirect 保留 query**：`/login?redirect=/analyze?symbol=2330` 的 redirect 需 `encodeURIComponent` 整個路徑，回跳後 symbol 才不會丟失。
4. **SSR 初始使用者（防閃爍）**：Header 是 client component，建議在 `app/layout.tsx`（Server Component）用 `cookies()` 解 JWT 後把初始使用者/額度傳給 Header，減少登入狀態閃爍；client 再以 `/api/auth/me` 同步。
5. **備援部署腳本**：`deploy.ps1`（方法 B 手動部署）也要同步新增 6 個 env appsettings，否則走備援時登入會失效。
6. **AUTH_SECRET 產生**：`openssl rand -base64 32` 產生，只存 GitHub Secret / Azure App Settings，禁止進 repo。
7. **LINE email**：LINE 預設不給 email；若要 email 需在 LINE Developers 開啟「email permission」（需送審）。MVP 容忍 `users.email` 為 NULL。
8. **CSRF**：logout 用 POST + `SameSite=Lax`；OAuth callback 用 state 驗證（防偽造回調）；`/api/analyze` 因受 JWT cookie + SameSite 保護，風險低。
9. **每日重置不需 cron**：額度以 `usage_date` 分日，跨日自動歸零，無需排程。
10. **首次使用競態**：`consumeQuota` 用「INSERT OR IGNORE 預建列 + 條件式 UPDATE」兩步，避免首筆並發時重複建列超扣。
11. **Cookie 屬性**：prod `Secure=true`、`httpOnly=true`、`SameSite=Lax`、Max-Age 30 天。
12. **額度響應 header（可選）**：429/200 可帶 `X-RateLimit-Remaining` 供前端/未來擴充。

---

## 相依圖
```
db.ts 新表 ──> DB helpers ──> lib/auth.ts
lib/oauth.ts ──> login/[provider] ──> callback/[provider] ──> me/logout
                                      ├──> /login 頁 ──> Header 整合
                                      └──> /api/analyze 閘道 ──> analyze 頁 401/429
OAuth Console ──> env/deploy.yml/deploy.ps1 ──> 上線驗收
```

## 風險與對策

| 風險 | 影響 | 機率 | 對策 |
|------|------|------|------|
| LINE OAuth 無法本機測試（redirect 需 https，禁止 localhost） | 高 | 高 | dev-login mock + 線上 staging 驗證 LINE |
| Azure SQL 建表語法與 SQLite 不一致 | 中 | 中 | 沿用現有雙路徑 IF NOT EXISTS 模式 |
| 並發下額度超扣/少扣 | 高 | 低 | `UPDATE … SET count=count+1 WHERE count<10` 單一原子語句 |
| AUTH_SECRET 管理不當 | 高 | 低 | 只放 GitHub Secret / Azure App Settings |
| SSE 回傳後才檢查額度 | 高 | 低 | 檢查必須在開啟串流前（同步），回 JSON |
| Header 登入狀態閃爍/誤導 | 中 | 中 | SSR cookies() 帶初始狀態 + client 同步 |

## 人力
| 角色 | 投入 | 主要工作 |
|------|------|----------|
| 開發者（1 人） | 約 4-6 工作天 | Phase 1-4 全包 |

## 實作進度核對（status，2026-08-05）

> 以當日程式碼實際掃描為準。結論：**Phase 1、Phase 2 已完整實作；Phase 3、Phase 4 的落差項已於 2026-08-05 補齊（Phase 1-4 全部完成）**。剩餘僅外部狀態（OAuth Console、GitHub Secrets、Azure App Settings、上線 e2e）需人工確認。
### Phase 1：資料庫與認證基礎 — ✅ 完成
- 三張表 `users`／`user_identities`／`api_usage`：已於 `db.ts` 以 `CREATE TABLE IF NOT EXISTS` 同步建於 SQLite 與 Azure SQL 雙路徑（db.ts:133-157, 267-296）。
- DB helpers：`findOrCreateUser`、`getUserById`、`getUsageCount`、`consumeAnalysisQuota`（原子 `UPDATE … SET count=count+1 WHERE count<max`，db.ts:1123）全數存在，並經 `index.ts` 匯出。
- 依賴：`jose ^6.2.8` 已進 `apps/web/package.json`；`lib/auth.ts` 提供 JWT sign/verify、httpOnly cookie（Secure/SameSite=Lax/Max-Age 30 天）、`getTaiwanDateStr`（Asia/Taipei）。
- 無獨立 `getQuota`／`requireUser()` helper，但以 `getUsageCount` 與 `getCurrentUserFromCookies` 取代，功能等價。

### Phase 2：OAuth API — ✅ 完成
- `lib/oauth.ts`：Google＋LINE 設定、authorize（含 PKCE S256）、token 交換、profile 抓取（Google userinfo／LINE `/v2/profile`，email 容忍 NULL）。
- `login/[provider]`：state＋PKCE，存 httpOnly cookie，正確 redirect（含 `safeRedirect` 防 open redirect）。
- `callback/[provider]`：驗 state → 換 code → 取 profile → upsert 使用者 → 簽 JWT → 設 cookie → 回跳（含 `?redirect=` 保留）。
- `me`、`logout`（POST）、`dev-login`（僅非 production）皆已實作。

### Phase 3：前端整合 — ✅ 完成（2026-08-05 補齊）
- `/login` 頁：Google／LINE 兩按鈕＋`?redirect=` 回跳、已登入自動導向。✅
- Header 整合：未登入顯示「登入」、登入後頭像/名稱/登出。✅
- analyze 頁閘道：`/api/analyze` 在 SSE 前同步 `getCurrentUserFromCookies()`（401 回 JSON）＋ `consumeAnalysisQuota()`（429 回 JSON）；前端又 401 → 導 `/login?redirect=…`、429 → 顯示額度用完。✅
- layout.tsx：SSR `cookies()` 解 JWT 帶初始使用者給 Header（防閃爍）。✅
- **落差分補齊**：`/api/auth/me` 現回傳 `quota{max,used,remaining}`；Header 登入後於使用者選單顯示「今日剩餘 AI 分析次數」（依 `/me` 同步更新）。

### Phase 4：設定與上線 — ✅ 完成（2026-08-05 補齊 deploy.ps1）
- `.env.example`：已含 `AUTH_SECRET`／`AUTH_BASE_URL`／`GOOGLE_CLIENT_ID/SECRET`／`LINE_CLIENT_ID/SECRET`。✅
- `deploy.yml`（GitHub Actions）：已將 6 個 auth env 寫入 `az webapp config appsettings set`，並引用對應 Secrets。✅
- **落差補齊**：`deploy.ps1` 已加入 6 個 auth env appsettings（從本機 env 讀取，未設定時寫佔位字串）。
- GitHub Secrets／Azure App Settings／OAuth Console 實際值、上線 e2e：屬外部狀態，本次掃描無法核對。

---

## 後續優化（不在本次 MVP）
- 同一 email 的 Google／LINE 身分自動合併成同一帳號
- `analysis_records` 加 `user_id`（「我的分析」私域化；目前紀錄維持全站公開）
- `/account` 頁：額度使用歷史、頭像編輯
- 若未來有密碼登入需求，再考慮 NextAuth 或增加 email/password 驗證
