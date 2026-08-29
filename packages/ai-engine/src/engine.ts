import {
  type AnalysisState,
  AssetType,
  AGENT_KEYS,
  AGENT_KEY_SET,
  DEFAULT_ANALYSIS_LANGUAGE,
  buildAnalysisLanguageInstruction,
  type AnalysisLanguage,
  type AppConfig,
  loadConfig,
} from '@stock/core'
import { registry, yahooFinanceProvider } from '@stock/market-data'
import { LLMFactory } from './llm/factory.js'
import { FallbackClient } from './llm/fallback-client.js'
import { LLMUsageTracker } from './llm/usage.js'
import type { LLMClient } from './llm/client.js'
import type { TokenUsageSummary, AgentUsage } from './llm/usage.js'
import { WorkflowGraph } from './graph/workflow.js'
import { MemoryLog } from './graph/memory.js'
import { Reflector } from './graph/reflection.js'
import { SignalProcessor } from './graph/signal.js'
import { tools } from './tools/index.js'
import {
  createMarketAnalyst,
  createSentimentAnalyst,
  createNewsAnalyst,
  createFundamentalsAnalyst,
  createBullResearcher,
  createResearchManager,
  createTrader,
  createPortfolioManager,
} from './agents/index.js'

async function resolveSymbol(rawTicker: string): Promise<string> {
  const trimmed = rawTicker.trim().toUpperCase()

  if (trimmed.endsWith('.TW') || trimmed.endsWith('.TWO')) {
    return trimmed
  }

  // 純數字代號（台股上市或上櫃）自動校正
  if (/^\d{4,6}$/.test(trimmed)) {
    try {
      const twSymbol = `${trimmed}.TW`
      const quote = await tools.getQuote(twSymbol)
      if (quote && quote.price > 0) return twSymbol
    } catch (_) {}

    try {
      const twoSymbol = `${trimmed}.TWO`
      const quote = await tools.getQuote(twoSymbol)
      if (quote && quote.price > 0) return twoSymbol
    } catch (_) {}
  }

  return trimmed
}

export type ProgressCallback = (step: string, detail: string) => void

export interface AnalyzeOptions {
  assetType?: AssetType
  /** 分析報告輸出語言，預設 zh-TW（繁體中文 + NTD）。 */
  language?: AnalysisLanguage
  /** 僅執行指定的 Agent（節點名稱需為 AGENT_KEYS 之一）。未提供時預設全數執行。 */
  enabledAgents?: string[]
}

export interface ModelPlan {
  deep: string
  quick: string
  fallback: {
    provider: string
    deep: string
    quick: string
    deepBaseUrl?: string
    quickBaseUrl?: string
    deepApiKeyHint?: string
    quickApiKeyHint?: string
  } | null
}

export class TradingEngine {
  private deepLLM: LLMClient
  private quickLLM: LLMClient
  private memory: MemoryLog
  private reflector: Reflector
  private signalProcessor = new SignalProcessor()
  private usageTracker = new LLMUsageTracker()
  private modelPlan: ModelPlan
  private config: AppConfig

  constructor() {
    registry.register(yahooFinanceProvider)

    this.config = loadConfig()

    const createClient = (model: string, provider?: string) => LLMFactory.create({
      provider: provider ?? this.config.llmProvider,
      model,
      temperature: this.config.temperature,
      baseUrl: provider !== 'google' ? this.config.backendUrl : undefined,
    })

    this.deepLLM = createClient(this.config.deepThinkModel)
    this.quickLLM = createClient(this.config.quickThinkModel)

    // ── Fallback 支援 deep/quick 兩組各自獨立 ──
    // 每個 group（deep / quick）可各自指定不同的 fallback model、baseUrl 與 apiKey，
    // 達到「每個 agent 群各自的免費 API token 備援」。
    // 環境變數優先序：
    //   群組專屬 (FALLBACK_DEEP_*) > 通用 (FALLBACK_LLM_*) > 沿用 primary。
    const fallbackProvider = process.env.FALLBACK_LLM_PROVIDER
    let fallbackPlan: ModelPlan['fallback'] = null
    if (fallbackProvider) {
      const fallbackDeepModel = process.env.FALLBACK_DEEP_THINK_MODEL ?? 'gemini-2.5-flash'
      const fallbackQuickModel = process.env.FALLBACK_QUICK_THINK_MODEL ?? 'gemini-2.5-flash'

      const createFallbackClient = (
        model: string,
        group: 'deep' | 'quick',
      ): LLMClient => {
        const groupPrefix = group === 'deep' ? 'FALLBACK_DEEP_' : 'FALLBACK_QUICK_'
        const baseUrl =
          process.env[`${groupPrefix}LLM_BACKEND_URL`]?.trim() ||
          process.env.FALLBACK_LLM_BACKEND_URL?.trim() ||
          (fallbackProvider !== 'google' ? this.config.backendUrl : '') ||
          undefined
        const apiKey =
          process.env[`${groupPrefix}LLM_API_KEY`]?.trim() ||
          process.env[`${groupPrefix}OPENAI_API_KEY`]?.trim() ||
          process.env.FALLBACK_LLM_API_KEY?.trim() ||
          process.env.FALLBACK_OPENAI_API_KEY?.trim() ||
          undefined
        return LLMFactory.create({
          provider: fallbackProvider,
          model,
          apiKey,
          baseUrl,
          temperature: this.config.temperature,
        })
      }

      this.deepLLM = new FallbackClient(this.deepLLM, createFallbackClient(fallbackDeepModel, 'deep'))
      this.quickLLM = new FallbackClient(this.quickLLM, createFallbackClient(fallbackQuickModel, 'quick'))
      fallbackPlan = {
        provider: fallbackProvider,
        deep: fallbackDeepModel,
        quick: fallbackQuickModel,
        deepBaseUrl:
          process.env.FALLBACK_DEEP_LLM_BACKEND_URL?.trim() ||
          process.env.FALLBACK_LLM_BACKEND_URL?.trim() ||
          (fallbackProvider !== 'google' ? this.config.backendUrl : '') ||
          undefined,
        quickBaseUrl:
          process.env.FALLBACK_QUICK_LLM_BACKEND_URL?.trim() ||
          process.env.FALLBACK_LLM_BACKEND_URL?.trim() ||
          (fallbackProvider !== 'google' ? this.config.backendUrl : '') ||
          undefined,
        deepApiKeyHint: this.apiKeyHint(
          process.env.FALLBACK_DEEP_LLM_API_KEY ||
            process.env.FALLBACK_DEEP_OPENAI_API_KEY ||
            process.env.FALLBACK_LLM_API_KEY ||
            process.env.FALLBACK_OPENAI_API_KEY,
        ),
        quickApiKeyHint: this.apiKeyHint(
          process.env.FALLBACK_QUICK_LLM_API_KEY ||
            process.env.FALLBACK_QUICK_OPENAI_API_KEY ||
            process.env.FALLBACK_LLM_API_KEY ||
            process.env.FALLBACK_OPENAI_API_KEY,
        ),
      }
    }

    this.modelPlan = {
      deep: this.config.deepThinkModel,
      quick: this.config.quickThinkModel,
      fallback: fallbackPlan,
    }

    this.deepLLM = this.usageTracker.attach(this.deepLLM)
    this.quickLLM = this.usageTracker.attach(this.quickLLM)

    this.memory = new MemoryLog(this.config.memoryLogPath)
    this.reflector = new Reflector(this.quickLLM)
  }

  /** 回傳每個 agent 階層所設定的 primary/fallback 模型清單，用於 DB 記錄與 UI 呈現。 */
  getModelPlan(): ModelPlan {
    return this.modelPlan
  }

  /** 把 apiKey 遮罩成前綴提示（例如 sk-abc...），避免明文外洩又方便辨識是哪一把 key。 */
  private apiKeyHint(key: string | undefined): string | undefined {
    if (!key) return undefined
    const k = key.trim()
    if (!k) return undefined
    return k.length <= 8 ? `${k}...` : `${k.substring(0, 8)}...`
  }

  async analyze(
    ticker: string,
    tradeDate: string,
    onProgress?: ProgressCallback,
    options: AnalyzeOptions = {},
  ): Promise<{ state: AnalysisState; signal: string; tokenUsage: TokenUsageSummary }> {
    this.usageTracker.reset()
    onProgress?.('Symbol Normalizer', 'Resolving ticker symbol...')
    const resolvedTicker = await resolveSymbol(ticker)

    const outputLanguage: AnalysisLanguage =
      options.language ?? (this.config.outputLanguage as AnalysisLanguage) ?? DEFAULT_ANALYSIS_LANGUAGE
    const outputInstruction = buildAnalysisLanguageInstruction(outputLanguage, this.config.twdUsdRate)

    const requestedAgents = options.enabledAgents && options.enabledAgents.length > 0
      ? options.enabledAgents
      : [...AGENT_KEYS]
    const enabledSet = new Set<string>(requestedAgents.filter(a => AGENT_KEY_SET.has(a)))
    const activeKeys = AGENT_KEYS.filter(k => enabledSet.has(k))

    if (activeKeys.length === 0) {
      throw new Error('至少需要啟用一個 Agent 才能進行 AI 分析（目前已全部停用）。')
    }

    let quoteContext = ''
    let profileContext = ''
    let historyContext = ''
    let quote: any = null
    let profile: any = null

    try {
      onProgress?.('Data Fetcher', `Fetching real-time quote for ${resolvedTicker}...`)
      quote = await tools.getQuote(resolvedTicker)
      quoteContext = `Current Price Quote for ${resolvedTicker}:
- Current Price: $${quote.price}
- Daily Volume: ${quote.volume}
- Last Quote Timestamp: ${new Date(quote.timestamp).toISOString()}`
    } catch (e: any) {
      console.warn(`[TradingEngine] Failed to fetch quote for ${resolvedTicker}:`, e.message)
    }

    try {
      onProgress?.('Data Fetcher', `Fetching company profile for ${resolvedTicker}...`)
      profile = await tools.getProfile(resolvedTicker)
      profileContext = `Company/Fund Profile:
- Name: ${profile.name}
- Sector: ${profile.sector ?? 'N/A'}
- Industry: ${profile.industry ?? 'N/A'}
- Exchange: ${profile.exchange ?? 'N/A'}
- Description: ${profile.description ?? 'N/A'}`
    } catch (e: any) {
      console.warn(`[TradingEngine] Failed to fetch profile for ${resolvedTicker}:`, e.message)
    }

    // Early-Exit Guard 門禁防禦：如果即時報價與 Profile 均無法獲取，代表無效股票代號，立即中斷阻斷！
    const hasValidQuote = quote && typeof quote.price === 'number' && quote.price > 0
    const hasValidProfile = profile && profile.name && profile.name !== resolvedTicker

    if (!hasValidQuote && !hasValidProfile) {
      throw new Error(`無法驗證股票代號 [${ticker}]。查無此股票之即時市場數據與基本面資料，已終止 AI 分析。請確認代號是否正確（例如台股 2330 / 2330.TW 或美股 AAPL）。`)
    }

    try {
      onProgress?.('Data Fetcher', `Fetching historical charts for ${resolvedTicker}...`)
      const history = await tools.getStockData(resolvedTicker)
      if (history && history.length > 0) {
        const recent = history.slice(-15)
        historyContext = `Recent 15-day Price History (OHLCV):
${recent.map(h => `- ${new Date(h.timestamp).toISOString().split('T')[0]}: Open $${h.open.toFixed(2)}, High $${h.high.toFixed(2)}, Low $${h.low.toFixed(2)}, Close $${h.close.toFixed(2)}, Vol ${h.volume}`).join('\n')}`
      }
    } catch (e: any) {
      console.warn(`[TradingEngine] Failed to fetch historical data for ${resolvedTicker}:`, e.message)
    }

    const instrumentContext = `The instrument to analyze is ${resolvedTicker}.

${profileContext}

${quoteContext}

${historyContext}`

    const initialState: AnalysisState = {
      ticker: resolvedTicker,
      tradeDate,
      assetType: options.assetType ?? AssetType.Stock,
      instrumentContext,
      pastContext: this.memory.getPastContext(ticker),
      outputLanguage,
      outputInstruction,
      marketReport: '',
      sentimentReport: '',
      newsReport: '',
      fundamentalsReport: '',
      investDebate: {
        bullHistory: '',
        bearHistory: '',
        history: '',
        currentResponse: '',
        judgeDecision: '',
        round: 0,
      },
      investmentPlan: '',
      traderProposal: '',
      riskDebate: {
        aggressiveHistory: '',
        conservativeHistory: '',
        neutralHistory: '',
        history: '',
        latestSpeaker: '',
        judgeDecision: '',
        round: 0,
      },
      finalDecision: '',
    }

    const graph = new WorkflowGraph()

    // agent 名稱 → 該 agent 產出的報告欄位（字串）；用於 fallback 時在末尾附加備援說明。
    const reportFieldByAgent: Record<string, keyof AnalysisState> = {
      'Market Analyst': 'marketReport',
      'Sentiment Analyst': 'sentimentReport',
      'News Analyst': 'newsReport',
      'Fundamentals Analyst': 'fundamentalsReport',
      'Research Manager': 'investmentPlan',
      'Trader': 'traderProposal',
      'Portfolio Manager': 'finalDecision',
    }

    const formatFallbackNote = (u: AgentUsage): string =>
      `\n\n---\n_⚠️ 本回覆已自動切換至備援模型：**${u.model}** (Token: prompt ${u.promptTokens} / completion ${u.completionTokens} / 合計 ${u.totalTokens})_`

    const appendFallbackNote = (
      result: Partial<AnalysisState>,
      name: string,
      usage: AgentUsage | null,
    ) => {
      if (!usage?.usedFallback) return
      const field = reportFieldByAgent[name]
      if (field && typeof result[field] === 'string') {
        ;(result as Record<string, any>)[field] += formatFallbackNote(usage)
      } else if (name === 'Bull Researcher' && result.investDebate?.currentResponse) {
        result.investDebate = {
          ...result.investDebate,
          currentResponse: result.investDebate.currentResponse + formatFallbackNote(usage),
        }
      }
    }

    const wrap = (name: string, fn: (s: AnalysisState) => Promise<Partial<AnalysisState>>) => {
      return async (s: AnalysisState) => {
        onProgress?.(name, 'running...')
        this.usageTracker.setCurrentAgent(name)
        const result = await fn(s)
        appendFallbackNote(result, name, this.usageTracker.getAgent(name))
        onProgress?.(name, 'done')
        return result
      }
    }

    const nodeFactories: Array<[string, (s: AnalysisState) => Promise<Partial<AnalysisState>>]> = [
      ['Market Analyst', createMarketAnalyst(this.quickLLM)],
      ['Sentiment Analyst', createSentimentAnalyst(this.quickLLM)],
      ['News Analyst', createNewsAnalyst(this.quickLLM)],
      ['Fundamentals Analyst', createFundamentalsAnalyst(this.quickLLM)],
      ['Bull Researcher', createBullResearcher(this.quickLLM)],
      ['Research Manager', createResearchManager(this.deepLLM)],
      ['Trader', createTrader(this.quickLLM)],
      ['Portfolio Manager', createPortfolioManager(this.deepLLM)],
    ]

    const activeNodes = nodeFactories.filter(([key]) => enabledSet.has(key))

    for (const [name, fn] of activeNodes) {
      graph.addNode(name, wrap(name, fn))
    }

    for (let i = 0; i < activeNodes.length - 1; i++) {
      graph.addEdge({ from: activeNodes[i][0], to: activeNodes[i + 1][0] })
    }
    graph.addEdge({ from: activeNodes[activeNodes.length - 1][0], to: '__end__' })

    graph.setEntryPoint(activeNodes[0][0])

    const finalState = await graph.execute(initialState)
    const signal = this.signalProcessor.process(finalState.finalDecision)
    const tokenUsage = this.usageTracker.getSummary()

    await this.memory.store({
      ticker,
      date: tradeDate,
      rating: signal,
      decision: finalState.finalDecision,
      pending: true,
    })

    return { state: finalState, signal, tokenUsage }
  }
}
