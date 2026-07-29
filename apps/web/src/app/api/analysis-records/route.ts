import { NextResponse } from 'next/server'
import { getAnalysisRecords } from '@stock/database'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const limitParam = searchParams.get('limit')
    const symbolParam = searchParams.get('symbol') || searchParams.get('q') || undefined
    const limit = limitParam ? parseInt(limitParam, 10) : 20

    const records = await getAnalysisRecords(limit, symbolParam)
    return NextResponse.json({ success: true, records: records || [] })
  } catch (error: any) {
    console.error('[API/Analysis-Records] Failed to fetch analysis records:', error)
    return NextResponse.json({ success: true, records: [] })
  }
}
