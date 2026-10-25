import PerkStrip, { type Perk } from './PerkStrip'
import { SITE_CONTAINER } from '@/src/features/photobooth/components/shared/layout/siteLayout'

/** A normal-flow footer in a full-height flex column: fills spare space above, never below. */
export default function PerkFooter({ perks }: { perks: Perk[] }) {
  return (
    <footer
      aria-label="Thông tin trải nghiệm"
      className={`${SITE_CONTAINER} mt-auto hidden shrink-0 pb-[max(32px,env(safe-area-inset-bottom))] md:block short:hidden`}
    >
      <PerkStrip perks={perks} className="border-t border-blush-deep/50 pt-8" />
    </footer>
  )
}
