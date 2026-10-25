import Link from 'next/link'
import type { ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'candy' | 'bubble'
type ButtonSize = 'md' | 'lg'

type ButtonProps = {
  children: ReactNode
  href?: string
  onClick?: () => void
  disabled?: boolean
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  type?: 'button' | 'submit'
}

const BASE_CLASS_NAME =
  // Icons keep their size in a tight button; without shrink-0 they collapse to a dot.
  'sweet-button inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold [&_svg]:shrink-0 ' +
  'transition-[transform,translate,scale,background-color,border-color,color,opacity,box-shadow] duration-200 ease-out-soft ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

const VARIANT_CLASS_NAMES: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-paper hover:bg-ink-soft',
  secondary: 'border border-line bg-white text-ink hover:border-ink/30',
  ghost: 'text-ink-soft hover:bg-paper-deep hover:text-ink',
  // Welcome "sticker" buttons: a solid lower edge gives them a pressable 2.5D look.
  candy:
    'bg-linear-to-b from-[#de5f7b] to-accent-deep text-white ring-4 ring-cream ' +
    'shadow-[0_5px_0_#8e2a43,0_16px_28px_-8px_rgba(176,58,85,0.55)] ' +
    'hover:-translate-y-0.5 hover:shadow-[0_7px_0_#8e2a43,0_20px_32px_-8px_rgba(176,58,85,0.6)] active:translate-y-0.5',
  bubble:
    'bg-white/85 text-cocoa ring-1 ring-blush-deep shadow-[0_4px_0_#f3c4cf,0_12px_24px_-10px_rgba(176,58,85,0.35)] ' +
    'hover:-translate-y-0.5 hover:bg-white active:translate-y-0.5',
}

const SIZE_CLASS_NAMES: Record<ButtonSize, string> = {
  md: 'h-12 px-6 text-[15px]',
  lg: 'h-14 px-8 text-[16px]',
}

/** Button styling for elements that cannot be a Button, e.g. client-only in-page links. */
export function getButtonClassName({
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
}: Pick<ButtonProps, 'variant' | 'size' | 'disabled' | 'className'> = {}) {
  return [
    BASE_CLASS_NAME,
    VARIANT_CLASS_NAMES[variant],
    SIZE_CLASS_NAMES[size],
    disabled ? 'pointer-events-none opacity-40' : '',
    className,
  ].join(' ')
}

export default function Button({
  children,
  href,
  onClick,
  disabled = false,
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
}: ButtonProps) {
  const classes = getButtonClassName({ variant, size, disabled, className })

  if (href && !disabled) {
    return (
      <Link href={href} scroll={false} className={classes} onClick={onClick}>
        {children}
      </Link>
    )
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {children}
    </button>
  )
}
