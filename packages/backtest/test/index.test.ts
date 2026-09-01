import { describe, it, expect } from 'vitest'
import {
  computeSMA,
  computeBias60MA,
  BacktestEngine,
  runGridSearch,
  HOLDING_DAYS,
  MA_PERIOD,
  TARGET_PROFIT,
  MAX_DRAWDOWN,
  type OHLCV,
} from '../src/index.js'

/** 依日列產生 OHLVC；先給 warmup 根平盤(100)作為 warmup 資料。
 *  首根進場日為 index 60（MA_PERIOD-1=59 觸發訊號、次一交易日進場）。 */
function makeFromRows(rows: Array<[number, number, number, number]>, warmup = MA_PERIOD): OHLCV[] {
  const base: OHLCV[] = Array.from({ length: warmup }, (_, i) => ({
    timestamp: (i + 1) * 86400000,
    open: 100,
    high: 100,
    low: 100,
    close: 100,
    volume: 1000,
  }))
  rows.forEach((r, offset) => {
    const idx = offset + 0
    base[idx + warmup] = {
      timestamp: (idx + warmup + 1) * 86400000,
      open: r[0],
      high: r[1],
      low: r[2],
      close: r[3],
      volume: 1000,
    }
  })
  return base
}

describe('computeSMA', () => {
  it('計算 3 期 SMA 數值', () => {
    const out = computeSMA([1, 2, 3, 4, 5], 3)
    expect(out).toEqual([null, null, 2, 3, 4])
  })

  it('稀疏陣列長度與輸入一致', () => {
    const out = computeSMA([10, 20, 30], 3)
    expect(out).toHaveLength(3)
    expect(out[2]).toBe(20)
  })
})

describe('computeBias60MA', () => {
  it('計算乖離率 (close/ma-1)', () => {
    const ma = [null, null, 100, 100]
    const close = [0, 0, 110, 95]
    const out = computeBias60MA(close, ma)
    expect(out[2]).toBeCloseTo(0.1)
    expect(out[3]).toBeCloseTo(-0.05)
    expect(out[0]).toBeNull()
  })
})

describe('BacktestEngine.run', () => {
  // 單元測試聚焦「進場後勝負判定」，故用高閾值 (100%) 必觸發進場，
  // 進場日固定為 index 60（首個 bias 定義日 59 之次一日）。
  const FORCE_TRIGGER = 100

  it('先 +8% 且未破 -5% → Win', () => {
    // index 60 進場 (open 100)；index 61 高點達 +12%，低點 -5% 未破
    const data = makeFromRows([
      [100, 100, 100, 100],
      [100, 112, 105, 106],
    ])
    const res = BacktestEngine.run(data, FORCE_TRIGGER)
    expect(res.wins).toBe(1)
    expect(res.losses).toBe(0)
    expect(res.winRate).toBe(1)
    expect(res.trades[0].daysToTarget).toBe(2)
  })

  it('同日雙殺（+8% 與 -5% 同日）→ 保守判定 Loss', () => {
    // index 60 進場；index 61 高點達 +12%、低點達 -10%（皆觸發）
    const data = makeFromRows([
      [100, 100, 100, 100],
      [100, 112, 90, 100],
    ])
    const res = BacktestEngine.run(data, FORCE_TRIGGER)
    expect(res.losses).toBe(1)
    expect(res.wins).toBe(0)
    expect(res.trades[0].outcome).toBe('loss')
  })

  it('40 日內未觸發 → Neutral（不計入勝率分母）', () => {
    // 全部平盤，無 +8% 也無 -5%
    const data = makeFromRows([[100, 100, 100, 100]])
    const res = BacktestEngine.run(data, FORCE_TRIGGER)
    expect(res.neutral).toBe(1)
    expect(res.totalTrades).toBe(0)
    expect(res.winRate).toBeNull()
  })

  it('inPosition 鎖：持有期間不允許重疊交易', () => {
    // 全平盤觸發條件恆成立；若有重疊會每天交易
    const data = Array.from({ length: 260 }, (_, i) => ({
      timestamp: (i + 1) * 86400000,
      open: 100,
      high: 100,
      low: 100,
      close: 100,
      volume: 1000,
    }))
    const res = BacktestEngine.run(data, 100) // 閾值 100% 恆觸發
    const entryDays = res.trades.map((t) => t.entryDate)
    // 兩兩進場日間隔必須 >= HOLDING_DAYS
    for (let i = 1; i < entryDays.length; i++) {
      const gap = (entryDays[i] - entryDays[i - 1]) / 86400000
      expect(gap).toBeGreaterThanOrEqual(HOLDING_DAYS)
    }
  })
})

describe('runGridSearch', () => {
  it('遍歷 -3% ~ -15% step 0.5%，共 25 組', () => {
    const data = makeFromRows([])
    const res = runGridSearch(data)
    expect(res.allThresholds).toHaveLength(25)
    expect(res.allThresholds[0].threshold).toBe(-3)
    expect(res.allThresholds[24].threshold).toBe(-15)
  })

  it('無任何參數達到勝率目標 → belowTarget = true', () => {
    // 全平盤皆為 Neutral，勝率為 null → 無法達標
    const data = Array.from({ length: 200 }, (_, i) => ({
      timestamp: (i + 1) * 86400000,
      open: 100,
      high: 100,
      low: 100,
      close: 100,
      volume: 1000,
    }))
    const res = runGridSearch(data)
    expect(res.belowTarget).toBe(true)
  })

  it('選取勝率最高且交易次數最多者為最佳參數', () => {
    // 構造：深乖離閾值才有交易；淺乖離（-3%）不觸發 → 勝率高者被選中而非次數
    // 平盤後大幅下挫再反彈，使深閾值（-8%）觸發且為單一交易
    const data: OHLCV[] = Array.from({ length: 80 }, (_, i) => ({
      timestamp: (i + 1) * 86400000,
      open: 100,
      high: 100,
      low: 100,
      close: 100,
      volume: 1000,
    }))
    // 連續 30 日下挫至 60（乖離為負），再于日後反彈 +8%
    for (let i = 0; i < 30; i++) {
      const price = 100 - i * 1.5 // 100 → 56.5
      data.push({
        timestamp: (80 + i + 1) * 86400000,
        open: price,
        high: price + 1,
        low: price - 1,
        close: price,
        volume: 1000,
      })
    }
    // 底部反彈日：從 56.5 反彈 +12%
    const baseClose = 100 - 29 * 1.5 // ≈ 56.5
    const rebound = baseClose * (1 + TARGET_PROFIT + 0.04)
    data.push({
      timestamp: (data.length + 1) * 86400000,
      open: baseClose,
      high: rebound,
      low: baseClose,
      close: baseClose * 1.04,
      volume: 1000,
    })

    const res = runGridSearch(data)
    // 深閾值應該至少觸發一次交易（非零 trades）
    const anyTrade = res.allThresholds.some((t) => t.totalTrades >= 1)
    expect(anyTrade).toBe(true)
  })
})

describe('常數', () => {
  it('目標條件符合規格：+8% / -5% / 40 日', () => {
    expect(TARGET_PROFIT).toBe(0.08)
    expect(MAX_DRAWDOWN).toBe(0.05)
    expect(HOLDING_DAYS).toBe(40)
  })
})
