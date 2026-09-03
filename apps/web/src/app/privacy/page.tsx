import Link from 'next/link'
import { getDict } from '@/i18n/server'

export const metadata = {
  title: '隱私權政策 — Vestential',
}

export default async function PrivacyPage() {
  const dict = await getDict()
  const d = dict.privacy
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-8">{d.title}</h1>
      <div className="prose prose-invert max-w-none space-y-6 text-sm text-[var(--text-secondary)] leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{d.s1Title}</h2>
          <p>{d.s1p1}</p>
          <p>{d.s1p2}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{d.s2Title}</h2>
          <p>{d.s2p1}</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>{d.s2li1}</li>
            <li>{d.s2li2}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{d.s3Title}</h2>
          <p>{d.s3p1}</p>
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
          <p>{d.s7p1}</p>
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