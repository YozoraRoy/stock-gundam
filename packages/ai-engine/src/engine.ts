import { type AnalysisState, AssetType, loadConfig } from '@stock/core'
import { registry, yahooFinanceProvider } from '@stock/market-data'
import { LLMFactory } from './llm/factory.js'
import { FallbackClient } from './llm/fallback-client.js'
import { LLMUsageTracker } from './llm/usage.js'
import type { LLMClient } from './llm/client.js'
import type { TokenUsageSummary } from './llm/usage.js'
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

export interface ModelPlan {
  deep: string
  quick: string
  fallback: {
    provider: string
    deep: string
    quick: string
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

  constructor() {
    registry.register(yahooFinanceProvider)

    const config = loadConfig()

    const createClient = (model: string, provider?: string) => LLMFactory.create({
      provider: provider ?? config.llmProvider,
      model,
      temperature: config.temperature,
      baseUrl: provider !== 'google' ? config.backendUrl : undefined,
    })

    this.deepLLM = createClient(config.deepThinkModel)
    this.quickLLM = createClient(config.quickThinkModel)

    const fallbackProvider = process.env.FALLBACK_LLM_PROVIDER
    let fallbackPlan: ModelPlan['fallback'] = null
    if (fallbackProvider) {
      const fallbackDeepModel = process.env.FALLBACK_DEEP_THINK_MODEL ?? 'gemini-2.5-flash'
      const fallbackQuickModel = process.env.FALLBACK_QUICK_THINK_MODEL ?? 'gemini-2.5-flash'
      this.deepLLM = new FallbackClient(this.deepLLM, createClient(fallbackDeepModel, fallbackProvider))
      this.quickLLM = new FallbackClient(this.quickLLM, createClient(fallbackQuickModel, fallbackProvider))
      fallbackPlan = {
        provider: fallbackProvider,
        deep: fallbackDeepModel,
        quick: fallbackQuickModel,
      }
    }

    this.modelPlan = {
      deep: config.deepThinkModel,
      quick: config.quickThinkModel,
      fallback: fallbackPlan,
    }

    this.deepLLM = this.usageTracker.attach(this.deepLLM)
    this.quickLLM = this.usageTracker.attach(this.quickLLM)

    this.memory = new MemoryLog(config.memoryLogPath)
    this.reflector = new Reflector(this.quickLLM)
  }

  /** 回傳每個 agent 階層所設定的 primary/fallback 模型清單，用於 DB 記錄與 UI 呈現。 */
  getModelPlan(): ModelPlan {
    return this.modelPlan
  }

  async analyze(
    ticker: string,
    tradeDate: string,
    onProgress?: ProgressCallback,
    assetType: AssetType = AssetType.Stock,
  ): Promise<{ state: AnalysisState; signal: string; tokenUsage: TokenUsageSummary }> {
    this.usageTracker.reset()
    onProgress?.('Symbol Normalizer', 'Resolving ticker symbol...')
    const resolvedTicker = await resolveSymbol(ticker)

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
      assetType,
      instrumentContext,
      pastContext: this.memory.getPastContext(ticker),
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

    const wrap = (name: string, fn: (s: AnalysisState) => Promise<Partial<AnalysisState>>) => {
      return async (s: AnalysisState) => {
        onProgress?.(name, 'running...')
        this.usageTracker.setCurrentAgent(name)
        const result = await fn(s)
        onProgress?.(name, 'done')
        return result
      }
    }

    graph.addNode('Market Analyst', wrap('Market Analyst', createMarketAnalyst(this.quickLLM)))
    graph.addNode('Sentiment Analyst', wrap('Sentiment Analyst', createSentimentAnalyst(this.quickLLM)))
    graph.addNode('News Analyst', wrap('News Analyst', createNewsAnalyst(this.quickLLM)))
    graph.addNode('Fundamentals Analyst', wrap('Fundamentals Analyst', createFundamentalsAnalyst(this.quickLLM)))
    graph.addNode('Bull Researcher', wrap('Bull Researcher', createBullResearcher(this.quickLLM)))
    graph.addNode('Research Manager', wrap('Research Manager', createResearchManager(this.deepLLM)))
    graph.addNode('Trader', wrap('Trader', createTrader(this.quickLLM)))
    graph.addNode('Portfolio Manager', wrap('Portfolio Manager', createPortfolioManager(this.deepLLM)))

    graph.addEdge({ from: 'Market Analyst', to: 'Sentiment Analyst' })
    graph.addEdge({ from: 'Sentiment Analyst', to: 'News Analyst' })
    graph.addEdge({ from: 'News Analyst', to: 'Fundamentals Analyst' })
    graph.addEdge({ from: 'Fundamentals Analyst', to: 'Bull Researcher' })
    graph.addEdge({ from: 'Bull Researcher', to: 'Research Manager' })
    graph.addEdge({ from: 'Research Manager', to: 'Trader' })
    graph.addEdge({ from: 'Trader', to: 'Portfolio Manager' })
    graph.addEdge({ from: 'Portfolio Manager', to: '__end__' })

    graph.setEntryPoint('Market Analyst')

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
