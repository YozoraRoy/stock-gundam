export class AppError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message)
    this.name = 'AppError'
  }
}

export class MarketDataError extends AppError {
  constructor(message: string) {
    super(message, 'MARKET_DATA_ERROR')
    this.name = 'MarketDataError'
  }
}

export class AIError extends AppError {
  constructor(message: string) {
    super(message, 'AI_ERROR')
    this.name = 'AIError'
  }
}
