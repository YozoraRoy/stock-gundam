const API_URL = 'https://openapi.twse.com.tw/v1/opendata/t187ap41_L'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

export interface TwseMeeting {
  /** ROC YYYYMMDD，例：1151013 表 115/10/13 */
  meetingDate: string
  /** ROC 日期轉 MM/DD，例：10/13；與 local DB 的 meeting_date 格式一致 */
  meetingDateMd: string
  meetingType: string
}

interface TwseRow {
  公司代號?: string
  股東常?: string
  開會日期?: string
  股務單位?: string
  /** TWSE 欄位名，例：股東常(臨時)會 */
  '股東常(臨時)會'?: string
  [key: string]: string | undefined
}

/** 抓 TWSE OpenAPI 上市公司股東會日期（官方來源）。回傳以股票代號為鍵的會期陣列。 */
export async function fetchTwseMeetings(): Promise<Record<string, TwseMeeting[]>> {
  const res = await fetch(API_URL, {
    headers: { 'user-agent': UA, 'accept': 'application/json' },
  })
  if (!res.ok) throw new Error(`TWSE t187ap41_L HTTP ${res.status}`)
  const rows = (await res.json()) as TwseRow[]
  if (!Array.isArray(rows)) throw new Error('TWSE t187ap41_L returned non-array')

  const map: Record<string, TwseMeeting[]> = {}
  for (const row of rows) {
    const sid = String(row['公司代號'] ?? '').trim()
    if (!/^\d{4,6}$/.exec(sid)) continue
    const date = String(row['開會日期'] ?? '').trim()
    if (!/^\d{7,8}$/.exec(date)) continue
    const md = rocYmdToMonthDay(date)
    if (!md) continue
    const m = map[sid] ?? (map[sid] = [])
    if (!m.some(x => x.meetingDate === date)) {
      m.push({
        meetingDate: date,
        meetingDateMd: md,
        meetingType: String(row['股東常(臨時)會'] ?? '').trim(),
      })
    }
  }
  return map
}

/** ROC YYYYMMDD → MM/DD；逾 7 位數或格式錯誤回傳 null */
export function rocYmdToMonthDay(rocYmd: string): string | null {
  const m = /^(\d{3})(\d{2})(\d{2})$/.exec(rocYmd || '')
  if (!m) return null
  const mm = m[2], dd = m[3]
  if (Number(mm) < 1 || Number(mm) > 12) return null
  if (Number(dd) < 1 || Number(dd) > 31) return null
  return `${mm}/${dd}`
}