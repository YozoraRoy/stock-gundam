import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@stock/core', '@stock/ai-engine', '@stock/market-data'],
}

export default nextConfig
