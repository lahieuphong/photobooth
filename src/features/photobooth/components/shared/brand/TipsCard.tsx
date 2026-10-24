import { Check, ChevronDown, Lightbulb } from 'lucide-react'
import { HeartSticker } from './Stickers'

type TipsCardProps = {
  /** Unique per page; labels the static card. */
  id: string
  tips: string[]
  title?: string
  className?: string
}

function TipList({ tips }: { tips: string[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {tips.map((tip) => (
        <li key={tip} className="flex items-start gap-2.5 text-[14px] leading-snug text-cocoa/85">
          <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent text-white">
            <Check aria-hidden="true" size={12} strokeWidth={3} />
          </span>
          {tip}
        </li>
      ))}
    </ul>
  )
}

/**
 * Butter-yellow tips: a static card where a side column has room (xl), a
 * collapsible one elsewhere. Not for pages where Space is a shortcut: a focused
 * <summary> would toggle and trigger it at once.
 */
export default function TipsCard({ id, tips, title = 'Gợi ý nhỏ', className = '' }: TipsCardProps) {
  return (
    <div className={className}>
      <details className="group rounded-[24px] bg-butter/80 ring-1 ring-cream xl:hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-[24px] px-4 font-bubble text-[17px] font-bold text-cocoa focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
          <Lightbulb aria-hidden="true" size={18} className="text-accent" />
          {title}
          <ChevronDown aria-hidden="true" size={18} className="ml-auto text-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-4 pb-4">
          <TipList tips={tips} />
        </div>
      </details>

      <section
        aria-labelledby={id}
        className="relative hidden -rotate-1 rounded-[28px] bg-butter p-5 shadow-[0_18px_32px_-22px_rgba(74,29,36,0.5)] ring-1 ring-cream xl:block"
      >
        <h2 id={id} className="mb-4 flex items-center gap-2 font-bubble text-[19px] font-bold text-cocoa">
          <Lightbulb aria-hidden="true" size={19} className="text-accent" />
          {title}
        </h2>
        <TipList tips={tips} />
        <HeartSticker className="absolute -right-3 -bottom-4 w-11 rotate-12" />
      </section>
    </div>
  )
}
