import { exportSyncData, mergeExports, applySyncMerge } from '../src/sync.js'
import type { SyncExport, MergedExport } from '../src/sync.js'

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined
}

function printStats(merged: MergedExport): void {
  for (const table of Object.keys(merged.stats)) {
    const s = merged.stats[table as keyof typeof merged.stats]
    console.log(
      `  ${table.padEnd(28)} total=${String(s.total).padStart(6)}  online=${String(s.fromOnline).padStart(6)}  local=${String(s.fromLocal).padStart(6)}`,
    )
  }
}

async function main(): Promise<void> {
  const baseUrl = argValue('--url') ?? process.env.SYNC_URL ?? ''
  const token = argValue('--token') ?? process.env.SYNC_TOKEN ?? ''
  const dryRun = process.argv.includes('--dry-run')

  if (!baseUrl || !token) {
    console.error('Usage: npm run db:sync -- [--url <SYNC_URL>] [--token <SYNC_TOKEN>] [--dry-run]')
    console.error('  or set SYNC_URL / SYNC_TOKEN env vars.')
    process.exit(1)
  }

  const base = baseUrl.replace(/\/+$/, '')
  const headers = {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  }

  console.log('1) pulling online export...')
  const res = await fetch(`${base}/api/sync/export`, { headers })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`export failed: HTTP ${res.status} ${text}`)
  }
  const onlinePayload = (await res.json()) as { success: boolean } & SyncExport
  const online: SyncExport = {
    exportedAt: onlinePayload.exportedAt,
    tables: onlinePayload.tables,
  }
  console.log(
    `   online: ${online.tables.odd_lot_trades.length} trades, ${online.tables.shareholder_gifts.length} gifts, ` +
    `${online.tables.historical_shareholder_gifts.length} hist-gifts, ${online.tables.analysis_records.length} analyses`,
  )

  console.log('2) merging (online wins on conflicts; latest per ticker)...')
  const local = await exportSyncData()
  const merged = mergeExports(local, online)
  printStats(merged)

  if (dryRun) {
    console.log('dry-run: no changes written')
    return
  }

  console.log('3) applying merge to local DB...')
  await applySyncMerge(merged)

  console.log('4) pushing merged data to online...')
  const localAfter = await exportSyncData()
  const pushRes = await fetch(`${base}/api/sync/import`, {
    method: 'POST',
    headers,
    body: JSON.stringify(localAfter),
  })
  const pushResult = await pushRes.json().catch(() => null)
  if (!pushRes.ok) {
    throw new Error(`import failed: HTTP ${pushRes.status} ${JSON.stringify(pushResult)}`)
  }
  console.log(`5) done. ${JSON.stringify(pushResult?.stats ?? pushResult)}`)
}

main().catch((err) => {
  console.error('[db:sync] failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
