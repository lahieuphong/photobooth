import { Aperture, ArrowLeft, Camera, Check, Download, Images, Sparkles, WandSparkles, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import type { PhotoboothScreen } from '@/src/features/photobooth/config/screenState'
import { PHOTOBOOTH_SCREENS } from '@/src/features/photobooth/config/screenState'
import BrandMark from './BrandMark'
import { SITE_CONTAINER } from './siteLayout'
import StepIndicator, { STEP_PILL_CLASS_NAME, pad } from './StepIndicator'

const STEPS = Object.values(PHOTOBOOTH_SCREENS).sort((a, b) => a.step - b.step)

const STEP_ICONS: Record<number, LucideIcon> = {
  1: Sparkles,
  2: Camera,
  3: Aperture,
  4: Images,
  5: WandSparkles,
  6: Download,
}

/** Read-only progress: steps are not links, the flow decides where you can go. */
function FlowStepper({ screen }: { screen: PhotoboothScreen }) {
  return (
    <ol aria-label="Các bước chụp ảnh" className="hidden items-start md:flex">
      {STEPS.map((step, index) => {
        const isCurrent = step.step === screen.step
        const isDone = step.step < screen.step
        const Icon = STEP_ICONS[step.step] ?? Sparkles

        return (
          <li key={step.route} aria-current={isCurrent ? 'step' : undefined} className="flex items-start">
            {index > 0 ? (
              <span
                aria-hidden="true"
                className={`mt-5 w-3 border-t-2 border-dashed lg:w-6 xl:w-9 ${isDone || isCurrent ? 'border-accent/45' : 'border-blush-deep'}`}
              />
            ) : null}
            <span className="flex w-14 flex-col items-center gap-1 text-center lg:w-16 xl:w-18">
              <span
                className={`grid size-10 place-items-center rounded-full transition-colors ${
                  isCurrent
                    ? 'bg-accent text-white shadow-[0_6px_14px_-6px_rgba(176,58,85,0.8)] ring-4 ring-cream'
                    : isDone
                      ? 'bg-blush text-accent ring-1 ring-blush-deep'
                      : 'bg-white/80 text-muted ring-1 ring-blush-deep'
                }`}
              >
                {isDone ? <Check aria-hidden="true" size={17} strokeWidth={2.6} /> : <Icon aria-hidden="true" size={18} />}
              </span>
              <span className={`text-[10px] font-semibold tabular-nums ${isCurrent ? 'text-accent-deep' : 'text-muted'}`}>
                <span className="sr-only">Bước </span>
                {pad(step.step)}
              </span>
              <span className={`text-[11px] leading-tight whitespace-nowrap ${isCurrent ? 'font-semibold text-cocoa' : 'text-ink-soft'}`}>
                {step.label}
                {isDone ? <span className="sr-only"> (đã xong)</span> : null}
              </span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

// A 44px round icon button where space is tight (phones, md–lg next to the stepper), labelled otherwise.
const BACK_CLASS_NAME =
  'inline-flex size-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-white/80 text-[14px] font-semibold text-cocoa ' +
  'shadow-[0_6px_16px_-12px_rgba(176,58,85,0.7)] ring-1 ring-blush-deep transition-[background-color,translate] duration-200 ease-out-soft ' +
  'hover:-translate-x-0.5 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
  'sm:w-auto sm:px-4 md:w-11 md:px-0 xl:w-auto xl:px-4 short:w-11 short:px-0'

const BACK_LABEL_CLASS_NAME = 'hidden whitespace-nowrap sm:inline md:hidden xl:inline short:hidden'

type FlowHeaderProps = {
  screen: PhotoboothScreen
  /** Overrides the screen's back link, e.g. to cancel a retake before leaving. */
  onBack?: () => void
  backLabel?: string
}

/**
 * Header of every flow screen, one row: back button and logo on the left, the
 * step progress in the middle (a stepper from `md`), and a compact "02 / 06"
 * pill on the right where the stepper does not fit.
 */
export default function FlowHeader({ screen, onBack, backLabel = 'Quay lại' }: FlowHeaderProps) {
  const backContent = (
    <>
      <ArrowLeft aria-hidden="true" size={19} />
      <span className={BACK_LABEL_CLASS_NAME}>{backLabel}</span>
    </>
  )
  // aria-label keeps the name when the label is hidden; the title shows it on hover.
  const back = onBack ? (
    <button type="button" onClick={onBack} aria-label={backLabel} title={backLabel} className={BACK_CLASS_NAME}>
      {backContent}
    </button>
  ) : screen.backHref ? (
    <Link href={screen.backHref} scroll={false} aria-label={backLabel} title={backLabel} className={BACK_CLASS_NAME}>
      {backContent}
    </Link>
  ) : null

  return (
    <header className={`${SITE_CONTAINER} pt-[env(safe-area-inset-top)]`}>
      <div className="grid h-16 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-3 sm:h-20 md:h-24 md:gap-x-4 short:h-14">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {back}
          <BrandMark size="nav" />
        </div>
        <div className="flex justify-center short:hidden">
          <FlowStepper screen={screen} />
        </div>
        <div className="col-start-3 flex justify-end">
          <StepIndicator screen={screen} stepClassName="text-accent-deep" className={`md:hidden short:block ${STEP_PILL_CLASS_NAME}`} />
        </div>
      </div>
    </header>
  )
}
