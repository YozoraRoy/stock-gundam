import { NextResponse } from 'next/server'
import { exportSyncData } from '@stock/database'
import { authorizeSync } from '@/lib/sync-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  if (!authorizeSync(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const data = await exportSyncData()
    return NextResponse.json({ success: true, ...data })
  } catch (error: any) {
    console.error('[API/sync/export] Failed:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Export failed' },
      { status: 500 },
    )
  }
}
