# Azure 手動部署腳本 (備援方法 Backups)
# 主要部署方式為 GitHub Actions（.github/workflows/deploy.yml，push main 自動部署）。
# 本腳本僅在 GitHub Actions 不可用、或需立即部署尚未推送之變更時作為備援。
# 注意：若未設定 $env:OPENAI_API_KEY，第 29 行會寫入 YOUR_API_KEY_HERE 覆寫線上金鑰！
Write-Host "=== 開始 Azure 手動部署規劃 (備援方法) ===" -ForegroundColor Cyan

$ResourceGroup = "rg-yuzora_roy_ai"
$Subscription = "c1a88666-9a4e-4a0f-8335-2b6191c4f38c"
$Location = "eastus2"
$PlanName = "asp-stock-platform"
$AppName = "stock-platform-roy"

# 1. 切換至正確的訂閱與目錄
Write-Host "1. 設定訂閱..." -ForegroundColor Yellow
az account set --subscription $Subscription

# 2. 建立 App Service 服務計劃 (Linux B1)
Write-Host "2. 建立 App Service 服務計劃..." -ForegroundColor Yellow
az appservice plan create --name $PlanName --resource-group $ResourceGroup --sku B1 --is-linux --location $Location

# 3. 建立 Web App 實例 (Node 20-lts)
Write-Host "3. 建立 Web App 實例..." -ForegroundColor Yellow
az webapp create --name $AppName --resource-group $ResourceGroup --plan $PlanName --runtime "NODE:20-lts"

# 4. 設定持久性儲存與啟動命令
Write-Host "4. 設定持久性儲存與啟動命令..." -ForegroundColor Yellow
az webapp config set --name $AppName --resource-group $ResourceGroup --startup-file "npm start" --always-on true
az webapp config appsettings set --name $AppName --resource-group $ResourceGroup --settings WEBSITES_ENABLE_APP_SERVICE_STORAGE=true

# 5. 設定 OpenCode API 與 Fallback 環境變數 (雲端零編譯零依賴安裝，本地完全自給自足)
Write-Host "5. 設定環境變數..." -ForegroundColor Yellow
$apiKey = if ($env:OPENAI_API_KEY) { $env:OPENAI_API_KEY } else { "YOUR_API_KEY_HERE" }
# AI 分析登入/額度相關環境變數（從本機 env 讀取；未設定時寫入佔位字串，上線前務必填入正確值）
$authSecret = if ($env:AUTH_SECRET) { $env:AUTH_SECRET } else { "YOUR_AUTH_SECRET_HERE" }
$googleClientId = if ($env:GOOGLE_CLIENT_ID) { $env:GOOGLE_CLIENT_ID } else { "YOUR_GOOGLE_CLIENT_ID" }
$googleClientSecret = if ($env:GOOGLE_CLIENT_SECRET) { $env:GOOGLE_CLIENT_SECRET } else { "YOUR_GOOGLE_CLIENT_SECRET" }
$lineClientId = if ($env:LINE_CLIENT_ID) { $env:LINE_CLIENT_ID } else { "YOUR_LINE_CLIENT_ID" }
$lineClientSecret = if ($env:LINE_CLIENT_SECRET) { $env:LINE_CLIENT_SECRET } else { "YOUR_LINE_CLIENT_SECRET" }
az webapp config appsettings set --name $AppName --resource-group $ResourceGroup --settings `
  LLM_PROVIDER=openai `
  OPENAI_API_KEY=$apiKey `
  LLM_BACKEND_URL=https://opencode.ai/zen/v1 `
  DEEP_THINK_MODEL=big-pickle `
  QUICK_THINK_MODEL=big-pickle `
  FALLBACK_LLM_PROVIDER=openai `
  FALLBACK_DEEP_THINK_MODEL=nemotron-3-ultra-free `
  FALLBACK_QUICK_THINK_MODEL=nemotron-3-ultra-free `
  LLM_TEMPERATURE=0.7 `
  NPM_RUN_BUILD=false `
  SCM_DO_BUILD_DURING_DEPLOYMENT=false `
  ENABLE_ORYX_BUILD=false `
  DATABASE_PATH=/home/data/stock.db `
  AUTH_SECRET=$authSecret `
  AUTH_BASE_URL=https://stock-platform-roy.azurewebsites.net `
  GOOGLE_CLIENT_ID=$googleClientId `
  GOOGLE_CLIENT_SECRET=$googleClientSecret `
  LINE_CLIENT_ID=$lineClientId `
  LINE_CLIENT_SECRET=$lineClientSecret

# 6. 在本地執行建置
Write-Host "6. 在本地執行專案建置..." -ForegroundColor Yellow
npm run local-build

# 7. 打包 Zip 並直接執行原生 Zip 部署 (使用 Windows 內建 tar.exe 產出相容 Linux 正斜線的 Zip 包，包含 node_modules 以免除雲端 npm install)
Write-Host "7. 打包並直接上傳部署 Zip..." -ForegroundColor Yellow
if (Test-Path deploy.zip) { Remove-Item deploy.zip -Force }
tar.exe -a -c -f deploy.zip --exclude=.git --exclude=azure_logs --exclude=logs.zip --exclude=deploy.zip --exclude=crash_logs* --exclude=apps/web/.next/cache *
az webapp deploy --resource-group $ResourceGroup --name $AppName --src-path ./deploy.zip --type zip

Write-Host "=== 部署完成！ ===" -ForegroundColor Green
Write-Host "您的專案已發布至：https://$AppName.azurewebsites.net" -ForegroundColor Green
