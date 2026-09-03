import Link from 'next/link'

const footerLinks = [
  { label: '隱私權政策', href: '/privacy' },
  { label: '服務條款', href: '/terms' },
  { label: '關於我們', href: '/about' },
]

export function Footer() {
  return (
    <footer className="border-t border-white/5 mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-[var(--text-secondary)]">
            © {new Date().getFullYear()} Vestential
          </div>
          <nav className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-[var(--text-primary)] transition"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  )
}