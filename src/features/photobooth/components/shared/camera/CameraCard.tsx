import type { ReactNode } from 'react'
import { Doodle, HeartSticker, StarSticker } from '@/src/features/photobooth/components/shared/brand/Stickers'

/**
 * White sticker-card frame around a CameraViewport (Ready, Capture). Sized from
 * two CSS variables set by an ancestor: `--camera-ratio` (slot width / height)
 * and `--camera-max-h` (height cap for the current layout).
 */
export default function CameraCard({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto w-[min(100%,calc(var(--camera-max-h)*var(--camera-ratio)+1.5rem))]">
      <HeartSticker className="absolute top-[58%] -left-4 z-10 hidden w-10 -rotate-12 animate-float sm:block" />
      <Doodle className="absolute -top-5 -right-4 z-10 hidden w-10 sm:block" />
      <StarSticker className="absolute -right-3 -bottom-3 z-10 w-8 animate-float [animation-delay:-1.5s] sm:w-10" />
      <div className="rounded-[32px] bg-white/90 p-3 shadow-[0_30px_60px_-30px_rgba(74,29,36,0.55)] ring-1 ring-blush-deep/70">
        <div className="flex aspect-(--camera-ratio) w-full">{children}</div>
      </div>
    </div>
  )
}
