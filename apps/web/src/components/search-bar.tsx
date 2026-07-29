'use client'

import { useState, type FormEvent } from 'react'
import { Search, Loader2 } from 'lucide-react'

interface SearchBarProps {
  onSearch: (symbol: string) => void
  loading: boolean
}

export function SearchBar({ onSearch, loading }: SearchBarProps) {
  const [symbol, setSymbol] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (symbol.trim()) onSearch(symbol.trim().toUpperCase())
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-secondary)]" />
          <input
            type="text"
            value={symbol}
            onChange={e => setSymbol(e.target.value)}
            placeholder="Search ticker (e.g. AAPL, TSLA, 2330.TW)..."
            className="w-full bg-[var(--bg-card)] border border-white/10 rounded-xl py-3 pl-10 pr-4
                       text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]
                       focus:outline-none focus:border-[var(--accent)] transition"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !symbol.trim()}
          className="bg-[var(--accent)] text-white px-6 rounded-xl font-medium
                     hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center gap-2 transition"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Analyze'}
        </button>
      </div>
    </form>
  )
}
