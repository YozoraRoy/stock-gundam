import Link from 'next/link'
import { Search, PieChart, Wallet, Activity, TrendingUp, Clock } from 'lucide-react'
import { getDict } from '@/i18n/server'

export const metadata = {
  title: '關於 Vestential',
}

export default async function AboutPage() {
  const dict = await getDict()
  const d = dict.about

  const steps = [
    { icon: PieChart, title: d.step1Title, desc: d.step1Desc, href: '/odd-lot', cta: d.step1Cta },
    { icon: Activity, title: d.step2Title, desc: d.step2Desc, href: '/backtest', cta: d.step2Cta },
    { icon: Wallet, title: d.step3Title, desc: d.step3Desc, href: '/portfolio', cta: d.step3Cta },
  ]

  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-8">{d.title}</h1>
      <div className="prose prose-invert max-w-none space-y-8 text-sm text-[var(--text-secondary)] leading-relaxed">
        <section>
          <p>{d.hero1}</p>
          <p>{d.hero2}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">{d.visionTitle}</h2>
          <p className="mb-4">{d.visionP1}</p>
          <p className="mb-4">{d.visionP2}</p>
          <p className="mb-3">{d.visionP3}</p>
          <div className="mt-4 rounded-xl border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/5 px-5 py-4">
            <p className="leading-relaxed text-[var(--text-secondary)]">{d.visionP4}</p>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">{d.methodTitle}</h2>
          <p className="mb-4">{d.methodIntro}</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-[var(--text-primary)]">{dict.about.methodBiasLabel}</strong> — {dict.about.methodBias}<span>（<Link href="/backtest" className="text-[var(--accent)] hover:underline">{dict.about.methodBiasLink}</Link>）。</span></li>
            <li><strong className="text-[var(--text-primary)]">{dict.about.methodOddLotLabel}</strong> — {dict.about.methodOddLot}<span>（<Link href="/odd-lot" className="text-[var(--accent)] hover:underline">{dict.about.methodOddLotLink}</Link>）。</span></li>
            <li><strong className="text-[var(--text-primary)]">{dict.about.methodPortfolioLabel}</strong> — {dict.about.methodPortfolio}<span>（<Link href="/portfolio" className="text-[var(--accent)] hover:underline">{dict.about.methodPortfolioLink}</Link>）。</span></li>
            <li><strong className="text-[var(--text-primary)]">{dict.about.methodAiLabel}</strong> — {dict.about.methodAi}<span>（<Link href="/analyze" className="text-[var(--accent)] hover:underline">{dict.about.methodAiLink}</Link>）。</span></li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{d.featuresTitle}</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>{d.featureAi}</li>
            <li>{d.featureOddLot}</li>
            <li>{d.featurePortfolio}</li>
            <li>{d.featureBacktest}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">{d.startTitle}</h2>
          <div className="not-prose grid grid-cols-1 md:grid-cols-3 gap-4">
            {steps.map((s, i) => (
              <div key={s.title} className="relative flex flex-col bg-[var(--bg-card)] rounded-xl p-5 border border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <s.icon className="w-6 h-6 text-[var(--accent)]" />
                  <span className="text-xs font-bold text-[var(--accent)]">STEP {i + 1}</span>
                </div>
                <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1.5">{s.title}</h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-4 flex-1">{s.desc}</p>
                <Link
                  href={s.href}
                  className="inline-flex items-center justify-center text-center rounded-lg bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 border border-[var(--accent)]/30 text-[var(--accent)] text-sm font-medium px-3 py-2 transition"
                >
                  {s.cta}
                </Link>
                {i < steps.length - 1 && (
                  <div className="hidden md:flex absolute top-1/2 -right-4 -translate-y-1/2 text-[var(--text-secondary)] z-10">
                    <span className="text-lg font-bold">→</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="mt-5 flex items-center gap-2 text-[var(--text-primary)]">
            <TrendingUp className="w-4 h-4 text-[var(--accent)]" />
            {d.closing}
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{d.openSourceTitle}</h2>
          <p>
            {d.openSourceDesc} <a href="https://github.com/YozoraRoy/vestential" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">GitHub</a>
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{d.disclaimerTitle}</h2>
          <p>{d.disclaimerDesc}</p>
        </section>
      </div>
      <div className="mt-8">
        <Link href="/" className="text-sm text-[var(--accent)] hover:underline">
          {dict.common.backToHome}
        </Link>
      </div>
    </div>
  )
}