'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { getAssetPath } from '@/src/features/photobooth/utils/assetPath'

type WelcomeLoadingScreenProps = {
  redirectTo?: string
  onComplete?: () => void
}

const MIN_LOADING_TIME_MS = 1200

export default function WelcomeLoadingScreen({
  redirectTo,
  onComplete,
}: WelcomeLoadingScreenProps) {
  const router = useRouter()
  const [progress, setProgress] = useState(8)

  useEffect(() => {
    let isCancelled = false

    const progressTicker = window.setInterval(() => {
      setProgress((current) => (current >= 94 ? current : current + 6))
    }, 90)

    const minDelayPromise = new Promise<void>((resolve) => {
      window.setTimeout(resolve, MIN_LOADING_TIME_MS)
    })

    const pageReadyPromise = new Promise<void>((resolve) => {
      if (document.readyState === 'complete') {
        resolve()
        return
      }

      const handleLoad = () => {
        window.removeEventListener('load', handleLoad)
        resolve()
      }

      window.addEventListener('load', handleLoad, { once: true })
    })

    Promise.all([minDelayPromise, pageReadyPromise]).then(() => {
      if (!isCancelled) {
        setProgress(100)
        window.setTimeout(() => {
          if (!isCancelled) {
            if (redirectTo) {
              router.replace(redirectTo)
              return
            }

            onComplete?.()
          }
        }, 180)
      }
    })

    return () => {
      isCancelled = true
      window.clearInterval(progressTicker)
    }
  }, [onComplete, redirectTo, router])

  const screenStyle: CSSProperties = {
    background: '#ffffff',
  }

  const progressFillStyle: CSSProperties = {
    width: `${progress}%`,
    background: '#FF5A2A',
  }

  return (
    <main
      className="fixed inset-0 z-[999] flex items-center justify-center"
      style={screenStyle}
      role="status"
      aria-live="polite"
    >
      <div className="flex w-[min(84vw,420px)] flex-col items-center gap-6 px-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-[88px]">
            <Image
              src={getAssetPath('/images/logos/photobooth-mark.svg')}
              alt=""
              aria-hidden="true"
              width={88}
              height={88}
              priority
              className="h-auto w-full"
              style={{ width: '100%', height: 'auto' }}
            />
          </div>

          <p className="font-serif text-[28px] font-medium uppercase leading-none tracking-[0.04em] text-[#1F2024]">
            Photobooth
          </p>
        </div>

        <div className="relative h-[6px] w-full rounded-full bg-[#E6E6E6]" aria-hidden="true">
          <div
            className="h-full rounded-full transition-[width] duration-150 ease-out"
            style={progressFillStyle}
          />
        </div>
      </div>
    </main>
  )
}
