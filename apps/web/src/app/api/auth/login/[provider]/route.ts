import { NextRequest, NextResponse } from 'next/server'
import type { AuthProvider } from '@stock/database'
import {
  applyOAuthCookie, buildProviderAuthUrl, getAuthBaseUrl, isProviderConfigured,
  pkceChallenge, randomString,
} from '../../../../../lib/oauth'

function safeRedirect(raw: string | null): string {
  const target = raw && raw.startsWith('/') ? raw : '/'
  return target.startsWith('//') ? '/' : target
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params
  if (provider !== 'google' && provider !== 'line') {
    return NextResponse.json({ success: false, error: 'unsupported provider' }, { status: 400 })
  }
  const authProvider = provider as AuthProvider
  if (!isProviderConfigured(authProvider)) {
    return NextResponse.json({ success: false, error: 'provider not configured' }, { status: 503 })
  }

  const baseUrl = getAuthBaseUrl(req)
  const redirectUri = `${baseUrl}/api/auth/callback/${authProvider}`
  const state = randomString(32)
  const codeVerifier = randomString(64)
  const codeChallenge = await pkceChallenge(codeVerifier)
  const redirect = safeRedirect(req.nextUrl.searchParams.get('redirect'))

  const authorizeUrl = buildProviderAuthUrl(authProvider, { redirectUri, state, codeChallenge })
  const res = NextResponse.redirect(authorizeUrl)
  return applyOAuthCookie(res, { state, codeVerifier, redirect })
}
