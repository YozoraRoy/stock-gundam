import type { Metadata } from 'next'
import './globals.css'
import { Header } from '@/components/header'
import { getCurrentUserFromCookies } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Stock Gundam',
  description: 'AI-powered stock analysis platform',
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

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased min-h-screen">
        <Header initialUser={initialUser} />
        {children}
      </body>
    </html>
  )
}
