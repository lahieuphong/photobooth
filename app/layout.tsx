import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Be_Vietnam_Pro, Newsreader } from 'next/font/google'
import { getAssetPath } from '@/src/features/photobooth/utils/assetPath'
import './globals.css'

// Both families ship a Vietnamese subset, so diacritics never fall back glyph by glyph.
const sans = Be_Vietnam_Pro({
  variable: '--font-be-vietnam',
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
})

const display = Newsreader({
  variable: '--font-newsreader',
  subsets: ['latin', 'vietnamese'],
  style: ['normal', 'italic'],
})

export const metadata: Metadata = {
  title: 'Photobooth',
  description: 'Chọn một trải nghiệm, chụp ảnh và tải về miễn phí.',
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
    statusBarStyle: 'default',
    title: 'Photobooth',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#faf7f2',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="vi"
      className={`${sans.variable} ${display.variable} h-full`}
    >
      <body className="min-h-screen bg-paper font-sans text-ink antialiased">
        {/* afterInteractive can run after window "load" already fired; register immediately then. */}
        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              var registerPhotoboothWorker = function () {
                navigator.serviceWorker.register('${getAssetPath('/sw.js')}', {
                  scope: '${getAssetPath('/')}'
                }).catch(function () {})
              }
              if (document.readyState === 'complete') registerPhotoboothWorker()
              else window.addEventListener('load', registerPhotoboothWorker, { once: true })
            }
          `}
        </Script>
        {children}
      </body>
    </html>
  )
}
