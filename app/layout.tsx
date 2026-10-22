import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Geist, Geist_Mono } from 'next/font/google'
import { getAssetPath } from '@/src/features/photobooth/utils/assetPath'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Photobooth',
  description: 'Photobooth chụp ảnh lấy liền với nhiều bố cục, bộ lọc và khung ảnh',
  manifest: getAssetPath('/manifest.webmanifest'),
  icons: {
    icon: [
      {
        url: getAssetPath('/pwa-icons/icon-192.png'),
        type: 'image/png',
        sizes: '192x192',
      },
      {
        url: getAssetPath('/pwa-icons/icon-512.png'),
        type: 'image/png',
        sizes: '512x512',
      },
    ],
    apple: [
      {
        url: getAssetPath('/pwa-icons/apple-touch-icon.png'),
        sizes: '180x180',
        type: 'image/png',
      },
    ],
    shortcut: [getAssetPath('/pwa-icons/icon-192.png')],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Photobooth',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-screen bg-[#111111] font-sans antialiased">
        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function () {
                navigator.serviceWorker.register('${getAssetPath('/sw.js')}', {
                  scope: '${getAssetPath('/')}'
                }).catch(function () {})
              })
            }
          `}
        </Script>
        {children}
      </body>
    </html>
  )
}
