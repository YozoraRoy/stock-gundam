'use client'

import { TrendingUp, LogOut, User, Zap } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const navItems = [
  { label: '首頁', href: '/' },
  { label: '分析', href: '/analyze' },
  { label: '零股情報', href: '/odd-lot' },
]

export interface HeaderUser {
  id: number
  displayName: string | null
  email: string | null
  avatarUrl: string | null
}

export function Header({ initialUser }: { initialUser: HeaderUser | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<HeaderUser | null>(initialUser)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetch('/api/auth/me')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !data?.success) return
        if (data.user) setUser(data.user)
        if (typeof data.quota?.remaining === 'number') setRemaining(data.quota.remaining)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      setUser(null)
      setMenuOpen(false)
      router.refresh()
    }
  }

  return (
    <header className="sticky top-0 z-50 bg-[var(--bg-primary)]/80 backdrop-blur-md border-b border-white/5">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-[var(--accent)]" />
          <span className="text-lg font-bold">Stock Gundam</span>
        </Link>
        <div className="flex items-center gap-1">
          <nav className="flex items-center gap-1 mr-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 text-sm rounded-lg transition ${
                    isActive
                      ? 'text-[var(--text-primary)] bg-white/10'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {user ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(prev => !prev)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition"
                aria-label="使用者選單"
              >
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="w-7 h-7 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="w-7 h-7 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] flex items-center justify-center text-xs font-bold">
                    {(user.displayName || user.email || 'U').slice(0, 1).toUpperCase()}
                  </span>
                )}
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-[var(--bg-card)] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/5">
                      <div className="text-sm font-medium truncate">
                        {user.displayName || '未命名使用者'}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                        {user.email || '未綁定 Email'}
                      </div>
                      {typeof remaining === 'number' && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-[var(--accent)]">
                          <Zap className="w-3.5 h-3.5" />
                          今日剩餘 AI 分析次數：{remaining}
                        </div>
                      )}
                    </div>
                    <Link
                      href="/analyze"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition"
                    >
                      <User className="w-4 h-4" />
                      我的分析
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-white/5 transition"
                    >
                      <LogOut className="w-4 h-4" />
                      登出
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="px-3 py-2 text-sm rounded-lg bg-[var(--accent)] text-white font-medium hover:opacity-90 transition"
            >
              登入
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
