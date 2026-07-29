---
name: azure-deploy
description: |
  Azure App Service 部署技能 (stock-platform 專案專用)。
  適用時機：當用戶要求「部署到 Azure」、「上線」、「佈署」、「推到線上」、「deploy」等指令時使用。
  本技能包含：根本原因診斷、一鍵部署流程、常見錯誤修復手冊。
---

# Azure App Service 部署技能

## 專案基本資訊

| 項目 | 值 |
|------|-----|
| 專案路徑 | `d:\PG\stock-platform` |
| Resource Group | `rg-yuzora_roy_ai` |
| App Name | `stock-platform-roy` |
| App Service Plan | `asp-stock-platform` (B1, Linux) |
| Node Runtime | `NODE:20-lts` |
| 訂閱 ID | `c1a88666-9a4e-4a0f-8335-2b6191c4f38c` |
| 線上 URL | `https://stock-platform-roy.azurewebsites.net` |

---

## 核心部署策略 (為什麼這樣做)

### 架構決策：Self-Contained Zip 部署（禁用 Oryx Build）

**問題根源**：Azure B1 方案 RAM 只有 1.75GB，如果在雲端執行 `npm install`，往往因超時（230秒限制）導致容器啟動失敗，出現 `sh: 1: next: not found (exit code 127)`。

**解決方案**：在本地完整建置 + 打包所有 `node_modules`，直接上傳一個「可即時執行」的完整 Zip 包。

### 關鍵設定

```
ENABLE_ORYX_BUILD=false           # 禁止 Azure 雲端重新 npm install
SCM_DO_BUILD_DURING_DEPLOYMENT=false  # 禁止雲端 SCM 建置觸發
WEBSITES_ENABLE_APP_SERVICE_STORAGE=true  # 開啟 /home 的持久化 NFS 掛載
DATABASE_PATH=/home/data/stock.db # SQLite 儲存在持久化目錄，不隨部署覆蓋消失
```

### 為什麼用 `tar.exe` 打包而非 `Compress-Archive`

Windows 的 `Compress-Archive` 使用反斜線 `\` 路徑，在 Linux 容器解壓後路徑會錯誤。改用 Windows 內建的 `tar.exe`（Win10 1803+ 內建）打包可正確輸出正斜線 `/` 相容的 Zip 格式。

---

## 完整部署流程 (SOP)

### Step 1：確認環境

```powershell
# 確認 Azure CLI 已登入
az account show

# 如果未登入
az login
```

### Step 2：執行一鍵部署腳本

```powershell
cd d:\PG\stock-platform
powershell -ExecutionPolicy Bypass -File deploy.ps1
```

**注意**：首次部署約需 5-8 分鐘（包含建置 + 上傳 + 雲端解壓）。更新部署約需 3-5 分鐘。

### Step 3：驗證部署成功

```powershell
# 查看最新啟動日誌
az webapp log download --name stock-platform-roy --resource-group rg-yuzora_roy_ai --log-file .\azure_logs.zip
Expand-Archive -Path .\azure_logs.zip -DestinationPath .\azure_logs -Force
Get-ChildItem .\azure_logs\LogFiles\StartupLogs | Sort-Object LastWriteTime -Descending | Select-Object -First 1 | Get-Content -Tail 30
```

**成功標誌**：日誌中出現 `✓ Ready in Xs` 和 `Site startup probe succeeded`

---

## 常見錯誤診斷手冊

### ❌ 錯誤 1：`sh: 1: next: not found (exit code 127)`

**症狀**：網站顯示 Application Error。日誌中有 `next: not found`。

**原因**：上傳的 Zip 沒有包含 `node_modules/.bin/next`（`node_modules.tar.gz` 未被正確打包進去）。

**修復步驟**：
1. 確認 `deploy.ps1` 使用 `tar.exe` 打包命令：
   ```powershell
   tar.exe -a -c -f deploy.zip --exclude=.git --exclude=deploy.zip * 
   ```
2. 確認 `package.json` 有 `start` script 指向 `npm run start --workspace=apps/web`
3. 重新執行 `powershell -ExecutionPolicy Bypass -File deploy.ps1`

---

### ❌ 錯誤 2：SSL EOF Error 上傳失敗

**症狀**：
```
HTTPSConnectionPool(host='stock-platform-roy.scm.azurewebsites.net', port=443): Max retries exceeded... SSLEOFError
```

**原因**：Azure 正在重啟容器，同時進行部署操作，觸發 SCM 衝突。

**修復步驟**：
1. 等待 60 秒讓 Azure 穩定
2. 重新執行 `powershell -ExecutionPolicy Bypass -File deploy.ps1`

---

### ❌ 錯誤 3：`Deployment has been stopped due to SCM container restart`

**症狀**：部署 Log 顯示 `status: 3, Deployment has been stopped due to SCM container restart`

**原因**：手動 `az webapp restart` 後馬上進行 Zip 部署，觸發競爭條件。

**修復步驟**：
1. 等待 90 秒
2. 重新執行 deploy.ps1（不要先手動 restart）

---

### ❌ 錯誤 4：歷史分析記錄消失（每次部署都清空）

**症狀**：`/analyze` 的歷史列表永遠是空的。

**原因**：SQLite 儲存在 `wwwroot` 下，每次 Zip 部署都會被覆蓋清空。

**修復方案**（已實作）：
- 在 `packages/database/src/db.ts` 中改為讀取 `process.env.DATABASE_PATH`
- 在 Azure App Settings 設定 `DATABASE_PATH=/home/data/stock.db`
- `/home` 掛載在 Azure 的持久化 NFS 上，不受部署影響

---

### ❌ 錯誤 5：`Building the app...` 超過 900 秒後 Build failed

**症狀**：部署時 Polling 狀態長時間停在 `Building the app...`，最終顯示 Build failed。

**原因**：`ENABLE_ORYX_BUILD` 沒有設為 false，Azure 嘗試在雲端執行 `npm install`，B1 方案記憶體不足超時。

**修復步驟**：
```powershell
az webapp config appsettings set --name stock-platform-roy --resource-group rg-yuzora_roy_ai --settings `
  ENABLE_ORYX_BUILD=false `
  SCM_DO_BUILD_DURING_DEPLOYMENT=false
```
然後重新部署。

---

## 環境變數清單 (完整)

| 變數名 | 值 | 用途 |
|--------|-----|------|
| `LLM_PROVIDER` | `openai` | AI 引擎使用的 Provider |
| `OPENAI_API_KEY` | `sk-xxx...` | OpenCode AI API Key |
| `LLM_BACKEND_URL` | `https://opencode.ai/zen/v1` | OpenCode API Endpoint |
| `DEEP_THINK_MODEL` | `big-pickle` | 深度思考 Agent 模型 |
| `QUICK_THINK_MODEL` | `big-pickle` | 快速思考 Agent 模型 |
| `FALLBACK_LLM_PROVIDER` | `openai` | Fallback Provider |
| `FALLBACK_DEEP_THINK_MODEL` | `nemotron-3-ultra-free` | Fallback 深度模型 |
| `FALLBACK_QUICK_THINK_MODEL` | `nemotron-3-ultra-free` | Fallback 快速模型 |
| `LLM_TEMPERATURE` | `0.7` | LLM 溫度設定 |
| `NPM_RUN_BUILD` | `false` | 禁止雲端建置 |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `false` | 禁止 SCM 建置 |
| `ENABLE_ORYX_BUILD` | `false` | 禁止 Oryx 建置 |
| `WEBSITES_ENABLE_APP_SERVICE_STORAGE` | `true` | 啟用 /home 持久化 |
| `DATABASE_PATH` | `/home/data/stock.db` | SQLite 持久化路徑 |

---

## 部署腳本說明 (deploy.ps1 解析)

```
deploy.ps1 執行順序：
1. az account set          → 切換正確訂閱
2. az appservice plan      → 建立/確認 App Service 計劃 (冪等)
3. az webapp create        → 建立/確認 Web App 實例 (冪等)
4. az webapp config set    → 設定啟動命令 + AlwaysOn
5. az webapp config appsettings set → 設定所有環境變數
6. npm run local-build     → 本地編譯所有 workspace + Next.js
7. tar.exe ... → 打包含 node_modules 的 Zip
8. az webapp deployment source config-zip → 上傳部署
```

---

## 關鍵注意事項

> [!IMPORTANT]
> **上線前必須先在本地測試**
> 每次部署前必須在本地執行完整的 e2e 測試，不可盲目上傳。

> [!WARNING]
> **不要同時執行 restart 和 deploy**
> `az webapp restart` 後至少等待 60 秒再進行部署，否則會觸發 SCM 競爭失敗。

> [!NOTE]
> **每次部署都包含 node_modules**
> 因為禁用了 Oryx Build，必須確保 `tar.exe` 打包命令包含了完整的 `node_modules` 目錄，否則容器啟動會找不到 `next` 等執行檔。
