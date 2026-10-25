import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

type StudioOptionProps = {
  isSelected: boolean
  onClick: () => void
  label: string
  caption?: string
  disabled?: boolean
  children: ReactNode
}

/** A preset tile (look, frame or layout); one per option in the active tab's radio group. */
export default function StudioOption({ isSelected, onClick, label, caption, disabled = false, children }: StudioOptionProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      onClick={onClick}
      disabled={disabled}
      className={[
        'group relative flex min-w-0 flex-col items-center gap-1.5 rounded-[18px] p-1.5 pb-2 text-center',
        'transition-[translate,background-color,box-shadow] duration-200 ease-out-soft',
        'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cocoa disabled:pointer-events-none disabled:opacity-45',
        isSelected
          ? 'animate-select bg-blush shadow-[0_0_0_2px_var(--color-accent),0_12px_22px_-14px_rgba(176,58,85,0.8)]'
          : 'bg-white/70 ring-1 ring-blush-deep/60 hover:-translate-y-0.5 hover:bg-white',
      ].join(' ')}
    >
      <span className="relative block w-full overflow-hidden rounded-[12px] bg-paper-deep">{children}</span>
      <span className={`text-[12px] leading-tight font-semibold ${isSelected ? 'text-accent-deep' : 'text-cocoa/80'}`}>{label}</span>
      {caption ? <span className="-mt-1 text-[10px] leading-tight text-muted">{caption}</span> : null}
      {isSelected ? (
        <span aria-hidden="true" className="animate-select absolute -top-1.5 -right-1.5 grid size-5.5 place-items-center rounded-full bg-accent text-white ring-2 ring-white">
          <Check size={12} strokeWidth={3.2} />
        </span>
      ) : null}
    </button>
  )
}
