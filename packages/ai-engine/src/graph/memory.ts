import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import { join } from 'node:path'

interface MemoryEntry {
  ticker: string
  date: string
  rating: string
  decision: string
  rawReturn?: number
  alphaReturn?: number
  reflection?: string
  pending: boolean
}

export class MemoryLog {
  private entries: MemoryEntry[] = []
  private logPath?: string

  constructor(logPath?: string) {
    this.logPath = logPath
  }

  async load() {
    if (!this.logPath) return
    try {
      await access(this.logPath)
      const text = await readFile(this.logPath, 'utf-8')
      this.entries = JSON.parse(text)
    } catch {
      this.entries = []
    }
  }

  async store(entry: MemoryEntry) {
    this.entries.push(entry)
    await this.flush()
  }

  getPastContext(ticker: string, nSame = 5, nCross = 3): string {
    const resolved = this.entries.filter(e => !e.pending)
    const same = resolved.filter(e => e.ticker === ticker).slice(-nSame)
    const cross = resolved.filter(e => e.ticker !== ticker).slice(-nCross)

    const parts: string[] = []
    if (same.length) {
      parts.push(`Past ${ticker} decisions (most recent):`)
      parts.push(...same.map(e =>
        `[${e.date}] ${e.rating} | Return: ${e.rawReturn ?? 'N/A'} | ${e.reflection ?? ''}`
      ))
    }
    if (cross.length) {
      parts.push('Cross-ticker lessons:')
      parts.push(...cross.map(e => `[${e.date} | ${e.ticker}] ${e.reflection ?? ''}`))
    }
    return parts.join('\n')
  }

  private async flush() {
    if (!this.logPath) return
    const dir = this.logPath.substring(0, this.logPath.lastIndexOf('\\'))
    await mkdir(dir, { recursive: true })
    await writeFile(this.logPath, JSON.stringify(this.entries, null, 2), 'utf-8')
  }
}
