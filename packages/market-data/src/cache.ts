/** 簡單的 TTL 記憶體快取（Map + 時間戳）。零依賴。 */
export class TTLCache<T> {
  private store = new Map<string, { value: T; expiresAt: number }>()

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | undefined {
    const hit = this.store.get(key)
    if (!hit) return undefined
    if (Date.now() >= hit.expiresAt) {
      this.store.delete(key)
      return undefined
    }
    return hit.value
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs })
  }

  clear(): void {
    this.store.clear()
  }
}
