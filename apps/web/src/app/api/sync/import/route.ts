import { NextResponse } from 'next/server'
import { exportSyncData, mergeExports, applySyncMerge } from '@stock/database'
import type { SyncExport } from '@stock/database'
import { authorizeSync } from '@/lib/sync-auth'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  if (!authorizeSync(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await req.json()) as Partial<SyncExport>
    if (!body?.tables) {
      return NextResponse.json({ success: false, error: 'Missing tables payload' }, { status: 400 })
    }

    const remote = body as SyncExport
    const online = await exportSyncData()
    const merged = mergeExports(remote, online)
    await applySyncMerge(merged)

    return NextResponse.json({ success: true, stats: merged.stats })
  } catch (error: any) {
    console.error('[API/sync/import] Failed:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Import failed' },
      { status: 500 },
    )
  }
}
