import Link from 'next/link'
import { getDict } from '@/i18n/server'

export const metadata = {
  title: '服務條款 — Vestential',
}

export default async function TermsPage() {
  const dict = await getDict()
  const d = dict.terms
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-8">{d.title}</h1>
      <div className="prose prose-invert max-w-none space-y-6 text-sm text-[var(--text-secondary)] leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{d.s1Title}</h2>
          <p>{d.s1p1}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{d.s2Title}</h2>
          <p className="text-[var(--accent-red)]">{d.s2p1}</p>
          <p>{d.s2p2}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{d.s3Title}</h2>
          <p>{d.s3p1}</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>{d.s3li1}</li>
            <li>{d.s3li2}</li>
            <li>{d.s3li3}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{d.s4Title}</h2>
          <p>{d.s4p1}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{d.s5Title}</h2>
          <p>{d.s5p1}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{d.s6Title}</h2>
          <p>{d.s6p1}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{d.s7Title}</h2>
          <p>
            {d.s7p1} <a href="https://github.com/YozoraRoy/vestential/issues" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">GitHub Issues</a>
          </p>
        </section>

        <p className="text-[var(--text-secondary)] pt-4">{d.updated}</p>
      </div>
      <div className="mt-8">
        <Link href="/" className="text-sm text-[var(--accent)] hover:underline">
          {dict.common.backToHome}
        </Link>
      </div>
    </div>
  )
}