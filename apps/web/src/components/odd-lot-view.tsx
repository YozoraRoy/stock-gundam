'use client'

import { useState, useMemo } from 'react'
import {
  Gift,
  Search,
  Calendar,
  Filter,
  ChevronRight,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  HelpCircle,
  TrendingUp,
  BarChart3,
  ExternalLink,
  History,
  X,
  RefreshCw,
} from 'lucide-react'
import {
  isTaiwanMarketTradingDay,
  getLastMarketTradingDay,
  formatLastBuyDateWithYear,
  formatTradingDayWithWeekday,
} from '@/utils/taiwan-calendar'

export interface OddLotItem {
  date: string
  stock_id: string
  stock_name: string
  price: number
  volume: number
  bid_price: number | null
  bid_volume: number | null
  ask_price: number | null
  ask_volume: number | null
  gift_name?: string | null
  meeting_date?: string | null
  last_buy_date?: string | null
  distribution_method?: string | null
  current_price?: number | null
  gift_status?: string | null
  claim_rule?: string | null
  claim_rule_source?: string | null
  mops_gift_text?: string | null
}

export type GiftCategory = 'ALL' | 'EGIFT' | 'CARD' | 'KITCHEN' | 'CARE' | 'LIFESTYLE' | 'PENDING' | 'NO_GIFT' | 'OTHER'

export type SortField =
  | 'default'
  | 'stock'
  | 'gift'
  | 'category'
  | 'last_buy_date'
  | 'unit_price'
  | 'total_amount'
  | 'volume'
  | 'cp_ratio'
  | 'restriction'

export type SortOrder = 'asc' | 'desc' | 'none'

export function normalizePriceAndVolume(
  price: number | null | undefined,
  volume: number | null | undefined,
  stockId?: string,
  currentPrice?: number | null
): { unitPrice: number | null; totalAmount: number | null; volume: number | null; isEstimated: boolean } {
  // price 為 TWSE TWT53U 官方「每股成交價」直接原樣呈現，不做任何猜測/覆寫。
  if (price == null || isNaN(price) || price <= 0) {
    if (currentPrice != null && currentPrice > 0) {
      const vol = volume ?? 0
      return {
        unitPrice: currentPrice,
        totalAmount: vol > 0 ? currentPrice * vol : null,
        volume: vol,
        isEstimated: true,
      }
    }
    return { unitPrice: null, totalAmount: null, volume: volume ?? 0, isEstimated: false }
  }

  const vol = volume ?? 0
  return {
    unitPrice: price,
    totalAmount: vol > 0 ? price * vol : null,
    volume: vol,
    isEstimated: false,
  }
}

export function getSingleSharePrice(
  price: number | null | undefined,
  volume: number | null | undefined,
  stockId?: string,
  currentPrice?: number | null
): number | null {
  const norm = normalizePriceAndVolume(price, volume, stockId, currentPrice)
  return norm.unitPrice
}

export function formatSingleSharePrice(
  price: number | null | undefined,
  volume: number | null | undefined,
  stockId?: string,
  currentPrice?: number | null
): { text: string; isEstimated: boolean } {
  const norm = normalizePriceAndVolume(price, volume, stockId, currentPrice)
  if (norm.unitPrice == null || norm.unitPrice <= 0) return { text: '未成交', isEstimated: false }
  return {
    text: `NT$ ${norm.unitPrice.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    isEstimated: norm.isEstimated,
  }
}

export function formatTotalAmount(
  price: number | null | undefined,
  volume?: number | null | undefined,
  stockId?: string,
  currentPrice?: number | null
): string {
  const norm = normalizePriceAndVolume(price, volume, stockId, currentPrice)
  if (norm.totalAmount == null || norm.totalAmount <= 0) return '—'
  const total = norm.totalAmount
  if (total >= 100000000) {
    const yi = total / 100000000
    return `NT$ ${yi.toLocaleString('zh-TW', { maximumFractionDigits: 2 })} 億`
  }
  if (total >= 10000) {
    const wan = total / 10000
    return `NT$ ${wan.toLocaleString('zh-TW', { maximumFractionDigits: 1 })} 萬`
  }
  return `NT$ ${Math.round(total).toLocaleString('zh-TW')}`
}

export function formatVolume(vol: number | null | undefined): string {
  if (vol == null || isNaN(vol)) return '0 股'
  if (vol >= 10000) {
    const wan = vol / 10000
    return `${wan.toLocaleString('zh-TW', { maximumFractionDigits: 1 })} 萬股`
  }
  return `${vol.toLocaleString('zh-TW')} 股`
}

export function estimateGiftValue(giftName?: string | null): number {
  const cat = classifyGift(giftName)
  switch (cat) {
    case 'EGIFT':
    case 'CARD':
      return 50
    case 'KITCHEN':
      return 120
    case 'LIFESTYLE':
      return 100
    case 'CARE':
      return 80
    case 'OTHER':
      return 60
    case 'PENDING':
    case 'NO_GIFT':
    default:
      return 0
  }
}

export function calculateCpRatio(
  price: number | null | undefined,
  giftName?: string | null,
  volume?: number | null | undefined,
  currentPrice?: number | null
): number {
  if (!volume || volume <= 0) return 0
  const unitP = getSingleSharePrice(price, volume, undefined, currentPrice)
  if (!unitP || unitP <= 0) return 0
  const estimatedValue = estimateGiftValue(giftName)
  if (estimatedValue <= 0) return 0
  return estimatedValue / unitP
}

export function getMonthDayWeight(dateStr?: string | null): number {
  if (!dateStr || dateStr === '—' || dateStr === 'null') return -1
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})$/)
  if (!match) return -1
  const month = parseInt(match[1], 10)
  const day = parseInt(match[2], 10)
  return month * 100 + day
}

export function formatCpRatio(ratio: number): { label: string; badgeClass: string } {
  if (ratio <= 0) return { label: '—', badgeClass: 'text-white/30' }
  const pct = Math.round(ratio * 100)
  if (ratio >= 2.0) {
    return { label: `🔥 ${ratio.toFixed(2)}x (${pct}%)`, badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold' }
  }
  if (ratio >= 1.0) {
    return { label: `✨ ${ratio.toFixed(2)}x (${pct}%)`, badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold' }
  }
  if (ratio >= 0.5) {
    return { label: `👍 ${ratio.toFixed(2)}x`, badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' }
  }
  return { label: `${ratio.toFixed(2)}x`, badgeClass: 'bg-white/5 text-white/60 border-white/10' }
}

export type RestrictionStatus = 'ALLOW_AGENT' | 'REQUIRE_EVOTE_OR_ATTEND' | 'NO_ODD_LOT_GIFT' | 'UNKNOWN'

// MOPS 官方公告分類 → 領取限制。claimRule 來自公開資訊觀測站股東會召集公告。
const OFFICIAL_RULE_MAP: Record<string, { status: RestrictionStatus; label: string; badgeClass: string }> = {
  ONE_SHARE: {
    status: 'ALLOW_AGENT',
    label: '✅ 1股可領',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  FULL_LOT: {
    status: 'NO_ODD_LOT_GIFT',
    label: '❌ 需滿千股',
    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  },
  NO_GIFT: {
    status: 'NO_ODD_LOT_GIFT',
    label: '➖ 無紀念品',
    badgeClass: 'bg-white/5 text-white/40 border-white/15',
  },
  MEETING_ONLY: {
    status: 'REQUIRE_EVOTE_OR_ATTEND',
    label: '⚠️ 需出席/電投',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
}

export function getOddLotRestriction(
  giftName?: string | null,
  distributionMethod?: string | null,
  claimRule?: string | null,
  claimRuleSource?: string | null,
): {
  status: RestrictionStatus
  label: string
  badgeClass: string
  source: string
  officialText?: string | null
} {
  // 優先採用 MOPS 官方公告分類（僅在拿到非 UNKNOWN 的官方規則時）
  if (claimRule && claimRuleSource === 'MOPS' && claimRule !== 'UNKNOWN' && OFFICIAL_RULE_MAP[claimRule]) {
    const cfg = OFFICIAL_RULE_MAP[claimRule]
    return { ...cfg, source: 'MOPS' }
  }

  const text = `${giftName || ''} ${distributionMethod || ''}`.toLowerCase()

  if (text.includes('親領') || text.includes('電子投票') || text.includes('電投') || text.includes('出席')) {
    return {
      status: 'REQUIRE_EVOTE_OR_ATTEND',
      label: '⚠️ 需電投/親領',
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      source: '推估',
    }
  }
  if (text.includes('不發') || text.includes('滿一張')) {
    return {
      status: 'NO_ODD_LOT_GIFT',
      label: '❌ 零股不發放',
      badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      source: '推估',
    }
  }
  if (!giftName || giftName === '-' || giftName === '待公告' || classifyGift(giftName) === 'NO_GIFT') {
    return {
      status: 'UNKNOWN',
      label: '⏳ 待公告',
      badgeClass: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
      source: '推估',
    }
  }

  return {
    status: 'ALLOW_AGENT',
    label: '✅ 零股可代領',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    source: '推估',
  }
}

export function classifyGift(giftName?: string | null): GiftCategory {
  if (!giftName || giftName === '-' || giftName === '無' || giftName === 'null') return 'NO_GIFT'
  const name = giftName.toLowerCase()

  if (name.includes('待') || name.includes('未') || name.includes('尚未')) {
    return 'PENDING'
  }
  // 優先判定 eGift / 電子卡 / 電子禮券 / 電子抵用券
  if (
    name.includes('egift') ||
    name.includes('e-gift') ||
    name.includes('電子')
  ) {
    return 'EGIFT'
  }

  if (
    name.includes('卡') ||
    name.includes('超商') ||
    name.includes('禮券') ||
    name.includes('商品券') ||
    name.includes('7-11') ||
    name.includes('全家') ||
    name.includes('義美') ||
    name.includes('萊爾富') ||
    name.includes('ok超') ||
    name.includes('50元') ||
    name.includes('100元') ||
    name.includes('兌換') ||
    name.includes('折扣') ||
    name.includes('提領')
  ) {
    return 'CARD'
  }
  if (
    name.includes('碗') ||
    name.includes('盤') ||
    name.includes('杯') ||
    name.includes('鍋') ||
    name.includes('壺') ||
    name.includes('保鮮盒') ||
    name.includes('餐具') ||
    name.includes('廚') ||
    name.includes('保溫') ||
    name.includes('刀') ||
    name.includes('洗碗') ||
    name.includes('便當') ||
    name.includes('筷') ||
    name.includes('墊') ||
    name.includes('餐墊') ||
    name.includes('隔熱')
  ) {
    return 'KITCHEN'
  }
  if (
    name.includes('洗') ||
    name.includes('皂') ||
    name.includes('沐浴') ||
    name.includes('洗髮') ||
    name.includes('牙') ||
    name.includes('護手') ||
    name.includes('面霜') ||
    name.includes('清潔') ||
    name.includes('防蚊') ||
    name.includes('衛生') ||
    name.includes('乳液')
  ) {
    return 'CARE'
  }
  if (
    name.includes('充') ||
    name.includes('線') ||
    name.includes('扇') ||
    name.includes('傘') ||
    name.includes('毛巾') ||
    name.includes('袋') ||
    name.includes('包') ||
    name.includes('電') ||
    name.includes('筆記') ||
    name.includes('工具') ||
    name.includes('帽') ||
    name.includes('布') ||
    name.includes('手套')
  ) {
    return 'LIFESTYLE'
  }

  return 'OTHER'
}

export const CATEGORY_CONFIG: Record<
  GiftCategory,
  { label: string; icon: string; badgeClass: string }
> = {
  ALL:      { label: '全部',          icon: '✨', badgeClass: 'bg-white/10 text-white border-white/20' },
  EGIFT:    { label: 'eGift 電子禮卡', icon: '📱', badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 font-bold' },
  CARD:     { label: '超商禮券卡',     icon: '💳', badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  KITCHEN:  { label: '居家餐廚',      icon: '🥣', badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  CARE:     { label: '清潔護理',      icon: '🧴', badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
  LIFESTYLE:{ label: '3C與生活',     icon: '🔌', badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  PENDING:  { label: '待公告',        icon: '⏳', badgeClass: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  NO_GIFT:  { label: '無紀念品',      icon: '➖', badgeClass: 'bg-white/5 text-white/40 border-white/10' },
  OTHER:    { label: '其他商品',      icon: '🎁', badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
}

const PAGE_SIZE = 100

interface OddLotViewProps {
  initialItems: OddLotItem[]
  latestDate?: string
  initialQuery?: string
}

export function OddLotView({ initialItems, latestDate, initialQuery = '' }: OddLotViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<GiftCategory>('ALL')
  const [searchQuery, setSearchQuery] = useState(initialQuery)
  const [page, setPage] = useState(1)

  // 排序與過濾狀態
  const [sortField, setSortField] = useState<SortField>('default')
  const [sortOrder, setSortOrder] = useState<SortOrder>('none')
  const [showAiTooltip, setShowAiTooltip] = useState(false)
  const [hideNoGift, setHideNoGift] = useState(true)   // 預設隱藏無紀念品股票
  const [onlyAllowAgent, setOnlyAllowAgent] = useState(false) // 僅顯示1股可代領
  const [onlyHighCp, setOnlyHighCp] = useState(false)   // 僅顯示高 CP 值 (回報 > 100%)
  const [hideExpired, setHideExpired] = useState(true)   // 預設隱藏已過最後買進日

  // 手動更新 TWSE 資料狀態
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleRefresh = async () => {
    setRefreshing(true)
    setRefreshMsg(null)
    try {
      const res = await fetch('/api/odd-lot/refresh', { method: 'POST' })
      const json = await res.json()
      if (res.status === 401) {
        const url = `/login?redirect=${encodeURIComponent('/odd-lot')}`
        window.location.href = url
        return
      }
      if (json.success) {
        if (json.throttled) {
          setRefreshMsg({ type: 'error', text: '剛剛才更新過，請稍後幾分鐘再試（避免重複抓取）' })
        } else {
          setRefreshMsg({ type: 'success', text: `已更新 ${json.oddLotCount} 筆零股 + ${json.giftCount} 筆紀念品，重新整理頁面...` })
          setTimeout(() => window.location.reload(), 1200)
        }
      } else {
        setRefreshMsg({ type: 'error', text: json.error || '更新失敗' })
      }
    } catch (e) {
      setRefreshMsg({ type: 'error', text: '網路錯誤，請稍後再試' })
    } finally {
      setRefreshing(false)
    }
  }

  // 近 5 年股東會紀念品歷史 Modal 狀態
  const [historyModalStock, setHistoryModalStock] = useState<{ stock_id: string; stock_name: string } | null>(null)
  const [historyData, setHistoryData] = useState<{ year: number; gift_name: string }[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const openHistoryModal = async (stockId: string, stockName: string) => {
    setHistoryModalStock({ stock_id: stockId, stock_name: stockName })
    setLoadingHistory(true)
    try {
      const res = await fetch(`/api/gifts/history?stock_id=${stockId}`)
      const json = await res.json()
      if (json.success && json.history) {
        setHistoryData(json.history)
      }
    } catch (e) {
      console.error('Failed to fetch gift history:', e)
    } finally {
      setLoadingHistory(false)
    }
  }

  // 1. 提取彙總 (合計) 資料，不進入個股列表
  const summaryItem = useMemo(() => {
    return initialItems.find(item => item.stock_name === '合計' || item.stock_id === '' || item.stock_id === '-')
  }, [initialItems])

  // 2. 去重並過濾掉「合計」資料列
  const dedupedItems = useMemo(() => {
    const seen = new Set<string>()
    return initialItems.filter(item => {
      // 排除「合計」或無代號列
      if (item.stock_name === '合計' || !item.stock_id || item.stock_id === '-') return false

      const key = `${item.date}-${item.stock_id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [initialItems])

  // 各分類數量計算（使用去重後的資料）
  const categoryCounts = useMemo(() => {
    const counts: Record<GiftCategory, number> = {
      ALL: dedupedItems.length,
      EGIFT: 0, CARD: 0, KITCHEN: 0, CARE: 0, LIFESTYLE: 0, PENDING: 0, NO_GIFT: 0, OTHER: 0,
    }
    for (const item of dedupedItems) {
      const cat = classifyGift(item.gift_name)
      counts[cat] = (counts[cat] || 0) + 1
    }
    return counts
  }, [dedupedItems])

  // 判斷最後買進日是否已過期（若最後買進日逢週末或國定假日，自動推算至前一個開市交易日）
  // 若提供 meeting_date，優先使用股東會日期判斷年份
  const isLastBuyDateExpired = (lastBuyDate: string | null | undefined, meetingDate?: string | null): boolean => {
    if (!lastBuyDate) return false // 無日期不過濾
    const match = lastBuyDate.match(/^(\d{1,2})\/(\d{1,2})$/)
    if (!match) return false

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    const month = parseInt(match[1], 10)
    const day = parseInt(match[2], 10)

    // 推斷年份：優先使用 meeting_date
    let year = currentYear
    if (meetingDate) {
      const meetingFull = meetingDate.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/)
      const meetingMd = meetingDate.match(/^(\d{1,2})[\/-](\d{1,2})$/)
      if (meetingFull) {
        year = parseInt(meetingFull[1], 10)
      } else if (meetingMd) {
        const meetMonth = parseInt(meetingMd[1], 10)
        if (meetMonth < currentMonth) {
          year = currentYear
        } else if (meetMonth >= currentMonth + 6) {
          year = currentYear - 1
        } else {
          year = currentYear
        }
      }
    } else {
      // 無 meeting_date 時使用跨年邏輯
      if (currentMonth >= 11 && month <= 4) {
        year = currentYear + 1
      }
    }

    let buyDate = new Date(year, month - 1, day)

    // 若最後買進日逢週末或國定休市日，往前自動推算至最後可買進之開市上班日
    if (!isTaiwanMarketTradingDay(buyDate)) {
      buyDate = getLastMarketTradingDay(buyDate)
    }

    const today = new Date(currentYear, now.getMonth(), now.getDate())
    return buyDate < today
  }

  // 套用篩選（無紀念品開關 + 可代領開關 + 高CP開關 + 分類 + 搜尋）
  const filteredItems = useMemo(() => {
    return dedupedItems.filter(item => {
      const cat = classifyGift(item.gift_name)

      // 隱藏已過最後買進日
      if (hideExpired && isLastBuyDateExpired(item.last_buy_date, item.meeting_date)) {
        return false
      }

      // 當開啟「隱藏無紀念品」且選「全部」分類時，自動過濾無紀念品項目
      if (hideNoGift && selectedCategory === 'ALL' && cat === 'NO_GIFT') {
        return false
      }

      // 僅顯示零股可代領
      if (onlyAllowAgent) {
        const rest = getOddLotRestriction(item.gift_name, item.distribution_method, item.claim_rule, item.claim_rule_source)
        if (rest.status !== 'ALLOW_AGENT') return false
      }

      // 僅顯示高 CP 值 (投報比 >= 1.0)
      if (onlyHighCp) {
        const cp = calculateCpRatio(item.price, item.gift_name, item.volume, item.current_price)
        if (cp < 1.0) return false
      }

      // 分類過濾
      if (selectedCategory !== 'ALL') {
        if (cat !== selectedCategory) return false
      }
      // 搜尋文字過濾
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase()
        const matchId = item.stock_id.toLowerCase().includes(q)
        const matchName = item.stock_name.toLowerCase().includes(q)
        const matchGift = (item.gift_name ?? '').toLowerCase().includes(q)
        return matchId || matchName || matchGift
      }
      return true
    })
  }, [dedupedItems, hideNoGift, hideExpired, onlyAllowAgent, onlyHighCp, selectedCategory, searchQuery])

  // 套用排序
  const sortedItems = useMemo(() => {
    if (sortField === 'default' || sortOrder === 'none') {
      return filteredItems
    }
    const items = [...filteredItems]
    const modifier = sortOrder === 'asc' ? 1 : -1

    items.sort((a, b) => {
      switch (sortField) {
        case 'stock':
          return a.stock_id.localeCompare(b.stock_id) * modifier
        case 'gift':
          return (a.gift_name || '').localeCompare(b.gift_name || '', 'zh-TW') * modifier
        case 'category':
          return classifyGift(a.gift_name).localeCompare(classifyGift(b.gift_name)) * modifier
        case 'last_buy_date': {
          const wA = getMonthDayWeight(a.last_buy_date)
          const wB = getMonthDayWeight(b.last_buy_date)
          return (wA - wB) * modifier
        }
        case 'unit_price': {
          const pA = getSingleSharePrice(a.price, a.volume, a.stock_id, a.current_price) ?? -1
          const pB = getSingleSharePrice(b.price, b.volume, b.stock_id, b.current_price) ?? -1
          return (pA - pB) * modifier
        }
        case 'total_amount': {
          const totA = getSingleSharePrice(a.price, a.volume, a.stock_id, a.current_price) != null
            ? (getSingleSharePrice(a.price, a.volume, a.stock_id, a.current_price) ?? 0) * (a.volume ?? 0)
            : 0
          const totB = getSingleSharePrice(b.price, b.volume, b.stock_id, b.current_price) != null
            ? (getSingleSharePrice(b.price, b.volume, b.stock_id, b.current_price) ?? 0) * (b.volume ?? 0)
            : 0
          return (totA - totB) * modifier
        }
        case 'volume':
          return ((a.volume ?? 0) - (b.volume ?? 0)) * modifier
        case 'cp_ratio':
          return (
            (calculateCpRatio(a.price, a.gift_name, a.volume, a.current_price) - calculateCpRatio(b.price, b.gift_name, b.volume, b.current_price)) *
            modifier
          )
        case 'restriction':
          return (
            getOddLotRestriction(a.gift_name, a.distribution_method, a.claim_rule, a.claim_rule_source).status.localeCompare(
              getOddLotRestriction(b.gift_name, b.distribution_method, b.claim_rule, b.claim_rule_source).status
            ) * modifier
          )
        default:
          return 0
      }
    })
    return items
  }, [filteredItems, sortField, sortOrder])

  // 排序標題切換處理
  const handleSort = (field: SortField) => {
    if (sortField !== field) {
      setSortField(field)
      setSortOrder('asc')
    } else {
      if (sortOrder === 'asc') setSortOrder('desc')
      else if (sortOrder === 'desc') {
        setSortField('default')
        setSortOrder('none')
      } else {
        setSortOrder('asc')
      }
    }
    setPage(1)
  }

  // 換頁時重置 page
  const handleCategoryChange = (cat: GiftCategory) => {
    setSelectedCategory(cat)
    setPage(1)
  }
  const handleSearchChange = (q: string) => {
    setSearchQuery(q)
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / PAGE_SIZE))
  const pagedItems = sortedItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const renderSortHeader = (label: string, field: SortField, alignRight = false) => {
    const isActive = sortField === field && sortOrder !== 'none'
    return (
      <th
        onClick={() => handleSort(field)}
        className={`px-4 py-3.5 font-semibold cursor-pointer select-none hover:text-white transition-colors ${
          alignRight ? 'text-right' : ''
        }`}
      >
        <div className={`inline-flex items-center gap-1.5 ${alignRight ? 'justify-end w-full' : ''}`}>
          <span>{label}</span>
          <span className="text-white/40">
            {isActive ? (
              sortOrder === 'asc' ? (
                <ArrowUp className="w-3.5 h-3.5 text-[var(--accent)]" />
              ) : (
                <ArrowDown className="w-3.5 h-3.5 text-[var(--accent)]" />
              )
            ) : (
              <ArrowUpDown className="w-3 h-3 opacity-40 hover:opacity-100" />
            )}
          </span>
        </div>
      </th>
    )
  }

  return (
    <div className="space-y-6">
      {/* 📊 市場整體零股交易合計面板 (固定置頂，不隨表格排序或操作) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[var(--bg-card)] border border-white/10 rounded-2xl p-4 flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-[var(--text-secondary)] mb-0.5">
              最新盤後交易日 {latestDate ? `(${formatTradingDayWithWeekday(latestDate)})` : ''} 盤後零股成交總金額
            </div>
            <div className="text-base md:text-lg font-mono font-bold text-white">
              {(() => {
                const totalAmt = dedupedItems.reduce((acc, item) => acc + (item.price ?? 0) * (item.volume ?? 0), 0)
                return totalAmt > 0 ? formatTotalAmount(totalAmt, 1) : (summaryItem ? formatTotalAmount(summaryItem.price, summaryItem.volume) : '—')
              })()}
            </div>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] border border-white/10 rounded-2xl p-4 flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-[var(--text-secondary)] mb-0.5">
              最新盤後交易日 {latestDate ? `(${formatTradingDayWithWeekday(latestDate)})` : ''} 盤後零股成交總股數
            </div>
            <div className="text-base md:text-lg font-mono font-bold text-white">
              {(() => {
                const totalVol = dedupedItems.reduce((acc, item) => acc + (item.volume ?? 0), 0)
                return totalVol > 0 ? formatVolume(totalVol) : (summaryItem ? formatVolume(summaryItem.volume) : '—')
              })()}
            </div>
          </div>
        </div>

        <div className="bg-[var(--bg-card)] border border-white/10 rounded-2xl p-4 flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 shrink-0">
            <Gift className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-[var(--text-secondary)] mb-0.5">零股交易標的總數</div>
            <div className="text-base md:text-lg font-mono font-bold text-white">
              {dedupedItems.length.toLocaleString()} 檔股票
            </div>
          </div>
        </div>
      </div>

      {/* 搜尋與過濾區塊 */}
      <div className="bg-[var(--bg-card)] border border-white/5 rounded-2xl p-4 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="搜尋股票代號、名稱、或紀念品關鍵字 (例如 2330 / 禮卡 / 保鮮盒)..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] transition"
            />
          </div>

          {/* ⚡ 快捷開關區塊 (隱藏無紀念品 / 1股可代領 / 高CP值) */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setHideNoGift(prev => !prev)
                setPage(1)
              }}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer select-none ${
                hideNoGift
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 shadow-lg shadow-amber-500/10'
                  : 'bg-white/5 text-[var(--text-secondary)] border-white/10 hover:text-white hover:border-white/20'
              }`}
            >
              <span
                className={`w-3 h-3 rounded-full border flex items-center justify-center transition-colors ${
                  hideNoGift ? 'border-amber-400 bg-amber-400' : 'border-white/30'
                }`}
              >
                {hideNoGift && <span className="w-1 h-1 rounded-full bg-slate-950" />}
              </span>
              <span>隱藏無紀念品 (預設)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setOnlyAllowAgent(prev => !prev)
                setPage(1)
              }}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer select-none ${
                onlyAllowAgent
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-lg shadow-emerald-500/10'
                  : 'bg-white/5 text-[var(--text-secondary)] border-white/10 hover:text-white hover:border-white/20'
              }`}
            >
              <span
                className={`w-3 h-3 rounded-full border flex items-center justify-center transition-colors ${
                  onlyAllowAgent ? 'border-emerald-400 bg-emerald-400' : 'border-white/30'
                }`}
              >
                {onlyAllowAgent && <span className="w-1 h-1 rounded-full bg-slate-950" />}
              </span>
              <span>✅ 僅 1 股可代領</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setOnlyHighCp(prev => !prev)
                setPage(1)
              }}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer select-none ${
                onlyHighCp
                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/30 shadow-lg shadow-rose-500/10'
                  : 'bg-white/5 text-[var(--text-secondary)] border-white/10 hover:text-white hover:border-white/20'
              }`}
            >
              <span
                className={`w-3 h-3 rounded-full border flex items-center justify-center transition-colors ${
                  onlyHighCp ? 'border-rose-400 bg-rose-400' : 'border-white/30'
                }`}
              >
                {onlyHighCp && <span className="w-1 h-1 rounded-full bg-slate-950" />}
              </span>
              <span>🔥 高 CP 值 (投報 &gt; 100%)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setHideExpired(prev => !prev)
                setPage(1)
              }}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer select-none ${
                hideExpired
                  ? 'bg-sky-500/15 text-sky-300 border-sky-500/30 shadow-lg shadow-sky-500/10'
                  : 'bg-white/5 text-[var(--text-secondary)] border-white/10 hover:text-white hover:border-white/20'
              }`}
            >
              <span
                className={`w-3 h-3 rounded-full border flex items-center justify-center transition-colors ${
                  hideExpired ? 'border-sky-400 bg-sky-400' : 'border-white/30'
                }`}
              >
                {hideExpired && <span className="w-1 h-1 rounded-full bg-slate-950" />}
              </span>
              <span>📅 隱藏已截止 (預設)</span>
            </button>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer select-none ${
                refreshing
                  ? 'bg-blue-500/15 text-blue-300 border-blue-500/30 animate-pulse'
                  : 'bg-blue-500/10 text-blue-300 border-blue-500/30 hover:bg-blue-500/20 hover:text-blue-200'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? '更新中...' : '手動更新'}</span>
            </button>
          </div>

          {refreshMsg && (
            <div
              className={`text-xs px-3 py-1.5 rounded-lg ${
                refreshMsg.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
              }`}
            >
              {refreshMsg.text}
            </div>
          )}
        </div>

        {/* 🎁 紀念品分類頁籤 (Filter Pills) */}
        <div>
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] mb-2.5 font-medium">
            <Filter className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>股東會紀念品類別篩選：</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CATEGORY_CONFIG) as GiftCategory[]).map(catKey => {
              const cfg = CATEGORY_CONFIG[catKey]
              const isSelected = selectedCategory === catKey
              const count = categoryCounts[catKey] || 0

              return (
                <button
                  key={catKey}
                  onClick={() => handleCategoryChange(catKey)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-lg shadow-[var(--accent)]/20'
                      : 'bg-white/5 text-[var(--text-secondary)] border-white/5 hover:border-white/20 hover:text-white'
                  }`}
                >
                  <span>{cfg.icon}</span>
                  <span>{cfg.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-white/10 text-[var(--text-secondary)]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* 資料表格列表 */}
      {filteredItems.length === 0 ? (
        <div className="bg-[var(--bg-card)] border border-white/5 rounded-2xl p-12 text-center text-sm text-[var(--text-secondary)]">
          <Gift className="w-8 h-8 text-[var(--text-secondary)] mx-auto mb-3 opacity-50" />
          <p className="font-medium text-base text-white mb-1">未找到符合條件的零股或紀念品資料</p>
          <p className="text-xs">
            {hideNoGift || onlyAllowAgent || onlyHighCp
              ? '目前已套用過濾條件 (無紀念品/代領限制/高CP值)，可點擊上方開關顯示全部。'
              : '請嘗試調整搜尋關鍵字或切換紀念品分類頁籤。'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* 統計與分頁資訊 */}
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] px-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span>
                共 <span className="text-white font-semibold">{filteredItems.length}</span> 筆
              </span>
              {hideNoGift && selectedCategory === 'ALL' && (
                <span className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                  已隱藏無紀念品股票
                </span>
              )}
              {onlyAllowAgent && (
                <span className="text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                  僅看零股可代領
                </span>
              )}
              {onlyHighCp && (
                <span className="text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md">
                  高 CP 值 (回報率 &gt; 100%)
                </span>
              )}
              {hideExpired && (
                <span className="text-[11px] text-sky-300 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-md">
                  📅 已隱藏截止過期標的
                </span>
              )}
              {selectedCategory !== 'ALL' && (
                <span className="text-[11px] text-[var(--accent)] bg-[var(--accent)]/10 border border-[var(--accent)]/20 px-2 py-0.5 rounded-md">
                  已套用分類篩選
                </span>
              )}
            </div>
            <span>
              第 <span className="text-white font-semibold">{page}</span> / <span className="text-white font-semibold">{totalPages}</span> 頁，每頁 {PAGE_SIZE} 筆
            </span>
          </div>

          <div className="w-full overflow-x-auto rounded-2xl border border-white/5 bg-[var(--bg-card)]">
            <table className="min-w-max w-full text-sm text-left">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-xs text-[var(--text-secondary)]">
                  {/* # 點擊恢復預設排序 */}
                  <th
                    onClick={() => handleSort('default')}
                    className="px-4 py-3.5 font-semibold cursor-pointer hover:text-white transition-colors"
                    title="點擊恢復預設排序"
                  >
                    #
                  </th>
                  {renderSortHeader('股票標的', 'stock')}
                  {renderSortHeader('🎁 股東會紀念品', 'gift')}
                  {renderSortHeader('分類', 'category')}
                  {renderSortHeader('🎫 1股領取限制', 'restriction')}
                  {renderSortHeader('⏳ 最後買進日', 'last_buy_date')}
                  {renderSortHeader('💵 1股成交價', 'unit_price', true)}
                  {renderSortHeader('💎 價值評分 (CP值)', 'cp_ratio', true)}
                  {renderSortHeader('💰 成交總金額', 'total_amount', true)}
                  {renderSortHeader('零股成交量', 'volume', true)}

                  {/* AI 評估標題帶有小問號 Tooltip */}
                  <th className="px-4 py-3.5 font-semibold text-center relative">
                    <div className="inline-flex items-center justify-center gap-1.5">
                      <span>AI 評估</span>
                      <div
                        className="relative flex items-center"
                        onMouseEnter={() => setShowAiTooltip(true)}
                        onMouseLeave={() => setShowAiTooltip(false)}
                        onClick={() => setShowAiTooltip(prev => !prev)}
                      >
                        <HelpCircle className="w-3.5 h-3.5 text-white/50 hover:text-white cursor-pointer transition-colors" />

                        {showAiTooltip && (
                          <div className="absolute right-0 top-full mt-2 w-64 bg-slate-900/95 backdrop-blur-md border border-white/20 p-3 rounded-xl shadow-2xl text-left z-50 pointer-events-none">
                            <div className="text-xs font-bold text-white mb-1 flex items-center gap-1">
                              <span>🤖 AI 多維度投資與效益評估</span>
                            </div>
                            <p className="text-[11px] text-white/80 leading-relaxed">
                              由 8 大專屬 AI Agent 結合這支股票的「技術面趨勢」、「零股成交流動性」及「股東會紀念品市場價值」進行綜合評估。
                            </p>
                            <div className="mt-1.5 pt-1.5 border-t border-white/10 text-[10px] text-[var(--accent)]">
                              點擊「AI 分析」按鈕可查看該股票專屬紀錄與完整報告
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {pagedItems.map((item, idx) => {
                  const giftName = item.gift_name && item.gift_name !== 'null' ? item.gift_name : null
                  const categoryKey = classifyGift(giftName)
                  const catConfig = CATEGORY_CONFIG[categoryKey]
                  const rowNum = (page - 1) * PAGE_SIZE + idx + 1

                  return (
                    <tr key={`${item.date}-${item.stock_id}-${idx}`} className="hover:bg-white/[0.03] transition-colors">
                      {/* 序號 */}
                      <td className="px-4 py-3.5 text-xs text-white/30 font-mono">{rowNum}</td>

                      {/* 股票名稱與代號（連至 Yahoo 股市台股個股行情頁面） */}
                      <td className="px-4 py-3.5">
                        <a
                          href={`https://tw.stock.yahoo.com/quote/${item.stock_id}.TW`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 group transition"
                          title={`前往 Yahoo 股市檢視 ${item.stock_name} (${item.stock_id}) 即時與盤後詳細行情`}
                        >
                          <span className="font-bold text-white text-base group-hover:text-[var(--accent)] group-hover:underline transition-colors">
                            {item.stock_name}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-[var(--accent)] font-mono group-hover:bg-[var(--accent)] group-hover:text-white transition-colors inline-flex items-center gap-1">
                            <span>{item.stock_id}</span>
                            <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                          </span>
                        </a>
                      </td>

                      {/* 🎁 紀念品名稱 + 近 5 年歷史小 Icon 連結 */}
                      <td className="px-4 py-3.5">
                        {giftName ? (
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Gift className="w-4 h-4 text-[var(--accent-green)] shrink-0" />
                              <span className="font-medium text-white truncate">{giftName}</span>
                            </div>
                            <button
                              onClick={() => openHistoryModal(item.stock_id, item.stock_name)}
                              title="點擊檢視近 5 年發放紀念品歷史"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/20 transition-all shrink-0 cursor-pointer"
                            >
                              <History className="w-3 h-3 text-indigo-400" />
                              <span>近5年</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-white/30 text-xs">—</span>
                        )}
                      </td>

                      {/* 分類徽章 */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${catConfig.badgeClass}`}>
                          {catConfig.icon} {catConfig.label}
                        </span>
                      </td>

                      {/* 🎫 1股領取限制 */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs">
                        {(() => {
                          const { label, badgeClass, source, officialText } = getOddLotRestriction(
                            giftName,
                            item.distribution_method,
                            item.claim_rule,
                            item.claim_rule_source,
                          )
                          const tip =
                            source === 'MOPS'
                              ? `來源：MOPS 官方股東會公告${officialText ? `\n${officialText}` : ''}`
                              : '來源：依紀念品文字推估，請以官方公告為準'
                          return (
                            <span
                              title={tip}
                              className={`px-2.5 py-0.5 rounded-full border font-medium text-xs ${badgeClass}`}
                            >
                              {label}
                              <span className="ml-1 opacity-70 text-[10px]">
                                {source === 'MOPS' ? '官方' : '估'}
                              </span>
                            </span>
                          )
                        })()}
                      </td>

                      {/* ⏳ 最後買進日 (包含年份與跨年標示) */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-[var(--text-secondary)]">
                        {(() => {
                          const dateInfo = formatLastBuyDateWithYear(item.last_buy_date, item.meeting_date)
                          if (!dateInfo) return <span className="text-white/40">-</span>
                          return (
                            <div className="flex items-center gap-1.5 font-medium">
                              <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span className={dateInfo.isCrossYear ? 'text-amber-300 font-bold' : 'text-emerald-400'}>
                                {dateInfo.formattedDate}
                              </span>
                              {dateInfo.isCrossYear && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  跨年
                                </span>
                              )}
                            </div>
                          )
                        })()}
                      </td>

                      {/* 💵 1股成交價 */}
                      <td className="px-4 py-3.5 text-right font-mono font-bold whitespace-nowrap">
                        {(() => {
                          const { text, isEstimated } = formatSingleSharePrice(item.price, item.volume, item.stock_id, item.current_price)
                          if (text === '未成交') return <span className="text-white/40">未成交</span>
                          return (
                            <span className={isEstimated ? 'text-cyan-400' : 'text-emerald-400'}>
                              {text}
                              {isEstimated && (
                                <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30" title="無零股成交，以即時股價推估">
                                  估
                                </span>
                              )}
                            </span>
                          )
                        })()}
                      </td>

                      {/* 💎 價值評分 (CP值) */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap font-mono text-xs">
                        {(() => {
                          const cpRatio = calculateCpRatio(item.price, giftName, item.volume, item.current_price)
                          const { label, badgeClass } = formatCpRatio(cpRatio)
                          return (
                            <span className={`px-2.5 py-0.5 rounded-lg border text-xs ${badgeClass}`}>
                              {label}
                            </span>
                          )
                        })()}
                      </td>

                      {/* 💰 成交總金額 */}
                      <td className="px-4 py-3.5 text-right font-mono text-xs text-white/80 whitespace-nowrap">
                        {formatTotalAmount(item.price, item.volume, item.stock_id, item.current_price)}
                      </td>

                      {/* 零股成交量 */}
                      <td className="px-4 py-3.5 text-right font-mono text-xs text-[var(--text-secondary)] whitespace-nowrap">
                        {formatVolume(item.volume)}
                      </td>

                      {/* AI 評估跳轉按鈕 */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <a
                          href={`/analyze?symbol=${item.stock_id}.TW`}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30 hover:bg-[var(--accent)] hover:text-white transition"
                        >
                          <span>AI 分析</span>
                          <ChevronRight className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* 分頁控制列 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 py-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 bg-white/5 text-[var(--text-secondary)] hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ChevronLeftIcon className="w-3.5 h-3.5" />
                上一頁
              </button>

              {/* 頁碼 */}
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                  .reduce<(number | '...')[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...')
                    acc.push(p)
                    return acc
                  }, [])
                  .map((p, i) =>
                    p === '...' ? (
                      <span key={`ellipsis-${i}`} className="px-2 text-white/30 text-xs">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p as number)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition ${
                          page === p
                            ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/20'
                            : 'bg-white/5 text-[var(--text-secondary)] hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
              </div>

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 bg-white/5 text-[var(--text-secondary)] hover:text-white hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                下一頁
                <ChevronRightIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] px-2">
            <span>顯示第 {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredItems.length)} 筆（共 {filteredItems.length} 筆）</span>
            <span>資料來源：TWSE 盤後零股交易市場 &amp; 股東會紀念品庫</span>
          </div>
        </div>
      )}

      {/* 📜 近 5 年股東會紀念品歷史 Modal 彈窗 */}
      {historyModalStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--bg-card)] border border-white/20 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 relative">
            {/* 關閉按鈕 */}
            <button
              onClick={() => setHistoryModalStock(null)}
              className="absolute top-4 right-4 p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* 標頭 */}
            <div className="flex items-center gap-3 pr-8">
              <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 shrink-0">
                <History className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {historyModalStock.stock_name} ({historyModalStock.stock_id})
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">近 5 年股東會紀念品發放歷程紀錄</p>
              </div>
            </div>

            {/* 歷史時間軸內容 */}
            {loadingHistory ? (
              <div className="py-8 text-center text-white/50 space-y-2">
                <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs">載入歷史紀錄中...</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
                {historyData.map((h) => {
                  const cat = classifyGift(h.gift_name)
                  const config = CATEGORY_CONFIG[cat]
                  return (
                    <div key={h.year} className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:border-indigo-500/30 transition-all">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-sm text-indigo-300 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">
                          {h.year} 年
                        </span>
                        <span className="font-medium text-white text-sm">{h.gift_name}</span>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.badgeClass}`}>
                        {config.icon} {config.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* 底部關閉按鈕 */}
            <div className="pt-2">
              <button
                onClick={() => setHistoryModalStock(null)}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition-all cursor-pointer text-center"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
