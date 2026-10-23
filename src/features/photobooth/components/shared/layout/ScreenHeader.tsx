import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { PhotoboothScreen } from '@/src/features/photobooth/config/screenState'
import { PHOTOBOOTH_STEP_COUNT } from '@/src/features/photobooth/config/screenState'
import BrandMark from './BrandMark'

type ScreenHeaderProps = {
  screen: PhotoboothScreen
  /** Overrides the screen's back link, e.g. to cancel a retake before leaving. */
  onBack?: () => void
  backLabel?: string
}

const pad = (value: number) => String(value).padStart(2, '0')

const BACK_CLASS_NAME =
  '-ml-3 inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-[14px] font-medium text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink focus-visible:outline-2 focus-visible:outline-accent'

export default function ScreenHeader({ screen, onBack, backLabel = 'Quay lại' }: ScreenHeaderProps) {
  const back = onBack ? (
    <button type="button" onClick={onBack} className={BACK_CLASS_NAME}>
      <ArrowLeft aria-hidden="true" size={18} />
      {backLabel}
    </button>
  ) : screen.backHref ? (
    <Link href={screen.backHref} scroll={false} className={BACK_CLASS_NAME}>
      <ArrowLeft aria-hidden="true" size={18} />
      {backLabel}
    </Link>
  ) : null

  // Three columns so the logo stays centered whatever the side contents are.
  return (
    <header className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3">
      <div className="justify-self-start">{back}</div>
      <BrandMark />
      <p className="justify-self-end text-right text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
        <span className="text-ink">{pad(screen.step)}</span>
        <span aria-hidden="true"> / {pad(PHOTOBOOTH_STEP_COUNT)}</span>
        <span className="sr-only"> trên {PHOTOBOOTH_STEP_COUNT}</span>
        <span aria-hidden="true"> · </span>
        {screen.label}
      </p>
    </header>
  )
}
