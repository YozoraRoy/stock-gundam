export enum Market {
  TW = 'TW',
  US = 'US',
}

export enum AssetType {
  Stock = 'stock',
  ETF = 'etf',
  Index = 'index',
  Crypto = 'crypto',
  Future = 'future',
}

export interface Ticker {
  symbol: string
  name: string
  market: Market
  assetType: AssetType
  exchange?: string
  currency?: string
}

export interface OHLCV {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export enum AnalystType {
  Market = 'market',
  Sentiment = 'sentiment',
  News = 'news',
  Fundamentals = 'fundamentals',
}

export enum Rating {
  Buy = 'Buy',
  Overweight = 'Overweight',
  Hold = 'Hold',
  Underweight = 'Underweight',
  Sell = 'Sell',
}

export enum TradingAction {
  Buy = 'Buy',
  Hold = 'Hold',
  Sell = 'Sell',
}

export enum SentimentBand {
  Bullish = 'Bullish',
  MildlyBullish = 'Mildly Bullish',
  Neutral = 'Neutral',
  Mixed = 'Mixed',
  MildlyBearish = 'Mildly Bearish',
  Bearish = 'Bearish',
}

export interface AnalystReport {
  type: AnalystType
  content: string
  timestamp: number
}

export interface InvestDebateState {
  bullHistory: string
  bearHistory: string
  history: string
  currentResponse: string
  judgeDecision: string
  round: number
}

export interface RiskDebateState {
  aggressiveHistory: string
  conservativeHistory: string
  neutralHistory: string
  history: string
  latestSpeaker: string
  judgeDecision: string
  round: number
}

export interface AnalysisState {
  ticker: string
  tradeDate: string
  assetType: AssetType
  instrumentContext: string
  pastContext: string
  marketReport: string
  sentimentReport: string
  newsReport: string
  fundamentalsReport: string
  investDebate: InvestDebateState
  investmentPlan: string
  traderProposal: string
  riskDebate: RiskDebateState
  finalDecision: string
}

export interface TradeDecision {
  ticker: string
  date: string
  rating: Rating
  action: TradingAction
  reasoning: string
  entryPrice?: number
  stopLoss?: number
  positionSizing?: string
  rawReturn?: number
  alphaReturn?: number
  reflection?: string
}

export interface BacktestResult {
  strategyName: string
  ticker: string
  startDate: string
  endDate: string
  totalReturn: number
  alphaReturn: number
  sharpeRatio: number
  maxDrawdown: number
  winRate: number
  trades: number
}
