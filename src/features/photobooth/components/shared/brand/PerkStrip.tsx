import type { ReactNode } from 'react'

export type Perk = { title: string; text: string; icon: ReactNode }

/** Row of small reassurance points under a flow screen: two columns, four from `lg`. */
export default function PerkStrip({ perks, className = '' }: { perks: Perk[]; className?: string }) {
  return (
    <ul className={`grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4 ${className}`}>
      {perks.map((perk) => (
        <li key={perk.title} className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-accent shadow-[0_8px_16px_-10px_rgba(176,58,85,0.7)] ring-1 ring-blush-deep">
            {perk.icon}
          </span>
          <span>
            <span className="block font-bubble text-[16px] font-bold text-cocoa">{perk.title}</span>
            <span className="block text-[13px] leading-snug text-ink-soft">{perk.text}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
