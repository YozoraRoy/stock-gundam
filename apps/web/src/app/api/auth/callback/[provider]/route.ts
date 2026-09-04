import { NextRequest, NextResponse } from 'next/server'
import { findOrCreateUser } from '@stock/database'
import type { AuthProvider } from '@stock/database'
import { applySessionCookie, signSession } from '../../../../../lib/auth'
import {
  exchangeProviderCode, fetchProviderProfile, getAuthBaseUrl,
  OAUTH_COOKIE, parseOAuthCookie,
} from '../../../../../lib/oauth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params
  if (provider !== 'google' && provider !== 'line') {
    return NextResponse.json({ success: false, error: 'unsupported provider' }, { status: 400 })
  }
  const authProvider = provider as AuthProvider

  const oauthState = parseOAuthCookie(req.cookies.get(OAUTH_COOKIE)?.value)
  const stateParam = req.nextUrl.searchParams.get('state')
  const errorParam = req.nextUrl.searchParams.get('error')
  if (!oauthState || !stateParam || oauthState.state !== stateParam) {
    return NextResponse.json({ success: false, error: 'oauth state mismatch' }, { status: 400 })
  }
  if (errorParam) {
    return NextResponse.json({ success: false, error: `provider returned error: ${errorParam}` }, { status: 400 })
  }
  const code = req.nextUrl.searchParams.get('code')
  if (!code) {
    return NextResponse.json({ success: false, error: 'missing authorization code' }, { status: 400 })
  }

  try {
    const baseUrl = getAuthBaseUrl(req)
    const redirectUri = `${baseUrl}/api/auth/callback/${authProvider}`
    const { accessToken, idToken } = await exchangeProviderCode(authProvider, {
      code,
      redirectUri,
      codeVerifier: oauthState.codeVerifier,
    })
    const profile = await fetchProviderProfile(authProvider, accessToken, idToken)
    const user = await findOrCreateUser({
      provider: authProvider,
      providerUserId: profile.providerUserId,
      email: profile.email ?? undefined,
      displayName: profile.displayName ?? undefined,
      avatarUrl: profile.avatarUrl ?? undefined,
      mergeByEmail: authProvider === 'google',
    })
    if (!user) {
      throw new Error('failed to create or find user')
    }
    const token = await signSession(user.id)

    const rawRedirect = oauthState.redirect
    const redirect = rawRedirect?.startsWith('/') && !rawRedirect.startsWith('//')
      ? new URL(rawRedirect, baseUrl).toString()
      : baseUrl
    const res = NextResponse.redirect(redirect)
    applySessionCookie(res, token)
    res.cookies.delete(OAUTH_COOKIE)
    return res
  } catch (error) {
    console.error('[API/Auth/Callback] Failed:', error)
    return NextResponse.json({ success: false, error: 'oauth callback failed' }, { status: 500 })
  }
}
