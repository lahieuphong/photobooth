import type { ComponentProps } from 'react'
import { PRINT_HEIGHT, PRINT_WIDTH } from '@/src/features/photobooth/domain/layouts'
import PhotoComposition from './PhotoComposition'

/** Largest print that fits the remaining space in both directions, without scrolling. */
export default function FittedComposition(props: ComponentProps<typeof PhotoComposition>) {
  return (
    <div className="flex min-h-0 w-full flex-1 items-center justify-center @container-[size]">
      <div
        className="shadow-[0_24px_60px_rgba(26,23,20,0.16)]"
        style={{ width: `min(100cqw, calc(100cqh * ${PRINT_WIDTH / PRINT_HEIGHT}))` }}
      >
        <PhotoComposition {...props} />
      </div>
    </div>
  )
}
