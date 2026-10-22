import type { NextConfig } from 'next'

const isProd = process.env.NODE_ENV === 'production'

// GitHub Pages serves this repo at https://lahieuphong.github.io/photobooth/.
// CI passes the path from actions/configure-pages so a repo rename cannot desync it.
const productionBasePath = process.env.PAGES_BASE_PATH ?? '/photobooth'
const basePath = isProd ? productionBasePath : ''

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  allowedDevOrigins: ['172.26.208.127', '*.trycloudflare.com'],
  images: {
    unoptimized: true,
  },
  basePath,
  assetPrefix: basePath ? `${basePath}/` : '',
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
}

export default nextConfig
