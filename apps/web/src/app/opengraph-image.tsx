import { ImageResponse } from 'next/og'
import { getDict } from '@/i18n/server'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Vestential — 價值投資的必備工具'

export default async function Image() {
  const dict = await getDict()
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 96px',
          background: 'linear-gradient(135deg, #0f1118 0%, #1a1d2e 60%, #222639 100%)',
          color: '#e8eaf0',
          fontFamily:
            '"PingFang TC", "Hiragino Sans CNS", "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 48,
            fontWeight: 800,
            color: '#4f8cff',
            letterSpacing: 1,
          }}
        >
          Vestential
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 20,
            fontSize: 64,
            fontWeight: 700,
            color: '#e8eaf0',
            lineHeight: 1.25,
          }}
        >
          {dict.home.heroTitle}
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 32,
            width: 120,
            height: 8,
            borderRadius: 4,
            background: 'linear-gradient(90deg, #4f8cff, #34d399)',
          }}
        />
        <div style={{ display: 'flex', marginTop: 32, fontSize: 28, color: '#9aa0b5' }}>
          https://vestential.com
        </div>
      </div>
    ),
    { width: size.width, height: size.height },
  )
}