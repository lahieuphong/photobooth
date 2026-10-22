import type { ReactNode } from 'react'

export type PhotoboothBackgroundVariant = 'plain' | 'soft'

type PhotoboothBackgroundProps = {
  children?: ReactNode
  variant?: PhotoboothBackgroundVariant
}

const SOFT_BACKGROUND_CLASS_NAME =
  'bg-[radial-gradient(120%_55%_at_50%_0%,#FFE7D6_0%,rgba(255,231,214,0)_72%),linear-gradient(180deg,#FFFFFF_40%,#FFF5EC_100%)]'

function SoftBackground({ children }: { children?: ReactNode }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-white isolate">
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 z-0 ${SOFT_BACKGROUND_CLASS_NAME}`}
      />

      <div className="relative z-10 h-full w-full">{children}</div>
    </div>
  )
}

function PlainBackground({ children }: { children?: ReactNode }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-white">
      <div className="relative z-10 h-full w-full">{children}</div>
    </div>
  )
}

export default function PhotoboothBackground({
  children,
  variant = 'plain',
}: PhotoboothBackgroundProps) {
  if (variant === 'soft') {
    return <SoftBackground>{children}</SoftBackground>
  }

  return <PlainBackground>{children}</PlainBackground>
}
