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
                className={`mt-5 w-5 border-t-2 border-dashed lg:w-9 ${isDone || isCurrent ? 'border-accent/45' : 'border-blush-deep'}`}
              />
            ) : null}
            <span className="flex w-16 flex-col items-center gap-1 text-center lg:w-18">
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
              <span className={`text-[11px] leading-tight ${isCurrent ? 'font-semibold text-cocoa' : 'text-ink-soft'}`}>
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

/**
 * Header of the playful flow screens: logo, step progress (a stepper from `md`,
 * a compact "02 / 06" pill on phones) and the screen's back link.
 */
export default function FlowHeader({ screen }: { screen: PhotoboothScreen }) {
  return (
    <header
      className={`${SITE_CONTAINER} grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 pt-[env(safe-area-inset-top)] short:gap-x-3`}
    >
      <div className="flex h-16 items-center sm:h-20 md:h-24 short:h-14">
        <BrandMark size="nav" />
      </div>
      <div className="flex justify-center short:hidden">
        <FlowStepper screen={screen} />
      </div>
      <div className="col-start-3 row-start-1 flex justify-end">
        <StepIndicator screen={screen} stepClassName="text-accent-deep" className={`md:hidden short:block ${STEP_PILL_CLASS_NAME}`} />
        {/* Balances the logo so the stepper sits centered. */}
        <span aria-hidden="true" className="hidden w-14 md:block lg:w-20 short:hidden" />
      </div>
      {screen.backHref ? (
        // Its own row; on sideways phones it joins the logo row to save height.
        <Link
          href={screen.backHref}
          scroll={false}
          className="col-span-3 inline-flex h-11 w-fit items-center gap-1.5 rounded-full bg-white/80 px-4 text-[14px] font-semibold text-cocoa shadow-[0_6px_16px_-12px_rgba(176,58,85,0.7)] ring-1 ring-blush-deep transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent short:col-span-1 short:col-start-2 short:row-start-1 short:h-10"
        >
          <ArrowLeft aria-hidden="true" size={18} />
          Quay lại
        </Link>
      ) : null}
    </header>
  )
}
