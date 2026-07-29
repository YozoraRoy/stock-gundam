import { registry } from '@stock/market-data'

export const tools = {
  getStockData: async (symbol: string) => {
    const provider = registry.get('yahoo-finance')
    return provider.getHistory(symbol, 'US')
  },

  getQuote: async (symbol: string) => {
    const provider = registry.get('yahoo-finance')
    return provider.getQuote(symbol, 'US')
  },

  getProfile: async (symbol: string) => {
    const provider = registry.get('yahoo-finance')
    return provider.getProfile(symbol, 'US')
  },

  searchSymbols: async (query: string) => {
    const provider = registry.get('yahoo-finance')
    return provider.searchSymbols(query)
  },
}

export type ToolName = keyof typeof tools
