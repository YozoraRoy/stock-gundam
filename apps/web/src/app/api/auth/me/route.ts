import { NextResponse } from 'next/server'
import { getUsageCount } from '@stock/database'
import { DAILY_ANALYSIS_LIMIT, getCurrentUserFromCookies, getTaiwanDateStr, isAdminUser } from '../../../../lib/auth'

export async function GET() {
  try {
    const user = await getCurrentUserFromCookies()
    if (!user) {
      return NextResponse.json({ success: false, error: 'not authenticated' }, { status: 401 })
    }
    const used = await getUsageCount(user.id, getTaiwanDateStr())
    const isAdmin = await isAdminUser(user)
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        displayName: user.display_name,
        email: user.email,
        avatarUrl: user.avatar_url,
        createdAt: user.created_at,
        isAdmin,
      },
      quota: {
        max: DAILY_ANALYSIS_LIMIT,
        used,
        remaining: Math.max(0, DAILY_ANALYSIS_LIMIT - used),
      },
    })
  } catch (error) {
    console.error('[API/Auth/Me] Failed:', error)
    return NextResponse.json({ success: false, error: 'internal error' }, { status: 500 })
  }
}
