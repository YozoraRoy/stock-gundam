import type { Metadata } from 'next'
import './globals.css'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { getCurrentUserFromCookies } from '@/lib/auth'
import { LanguageProvider } from '@/i18n/LanguageProvider'
import { getLocale } from '@/i18n/server'

export const metadata: Metadata = {
  metadataBase: new URL('https://vestential.com'),
  title: 'Vestential',
  description: 'AI-powered stock analysis platform for working professionals: quarterly-line deviation, odd-lot accumulation, P&L tracking, and AI analysis.',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUserFromCookies()
  const initialUser = user
    ? {
        id: user.id,
        displayName: user.display_name,
        email: user.email,
        avatarUrl: user.avatar_url,
      }
    : null
  const locale = await getLocale()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="antialiased min-h-screen flex flex-col">
        <LanguageProvider>
          <Header initialUser={initialUser} />
          <main className="flex-1">{children}</main>
          <Footer />
        </LanguageProvider>
      </body>
    </html>
  )
}
