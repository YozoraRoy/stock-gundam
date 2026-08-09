import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@stock/core', '@stock/ai-engine', '@stock/market-data'],
}

export default nextConfig
