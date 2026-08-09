import { timingSafeEqual } from 'node:crypto'

export function authorizeSync(req: Request): boolean {
  const expected = process.env.SYNC_TOKEN
  if (!expected || expected.length < 16) return false

  const header = req.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ')
    ? header.slice(7)
    : (req.headers.get('x-sync-token') ?? '')

  if (!token) return false

  const a = Buffer.from(expected)
  const b = Buffer.from(token)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
