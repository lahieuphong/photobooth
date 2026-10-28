import type { PhotoboothScreen } from '@/src/features/photobooth/config/screenState'
import { PHOTOBOOTH_STEP_COUNT } from '@/src/features/photobooth/config/screenState'
import { pad } from '@/src/features/photobooth/utils/format'

type StepIndicatorProps = {
  screen: PhotoboothScreen
  className?: string
  /** Color of the current step number. */
  stepClassName?: string
}

/** Pill look used on the playful screens (Experience, Ready). */
export const STEP_PILL_CLASS_NAME =
  'rounded-full bg-white/80 px-3.5 py-1.5 whitespace-nowrap text-accent-deep/70 shadow-[0_6px_16px_-12px_rgba(176,58,85,0.7)] ring-1 ring-blush-deep max-[359px]:px-2.5 max-[359px]:tracking-[0.1em]'

/** "01 / 06 · Trải nghiệm", read by screen readers as "01 trên 6 · Trải nghiệm". */
export default function StepIndicator({ screen, className = '', stepClassName = 'text-ink' }: StepIndicatorProps) {
  return (
    <p className={`text-[11px] font-semibold tracking-[0.2em] text-muted uppercase ${className}`}>
      <span className={stepClassName}>{pad(screen.step)}</span>
      <span aria-hidden="true"> / {pad(PHOTOBOOTH_STEP_COUNT)}</span>
      <span className="sr-only"> trên {PHOTOBOOTH_STEP_COUNT}</span>
      <span aria-hidden="true"> · </span>
      {screen.label}
    </p>
  )
}
