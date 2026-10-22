import Link from 'next/link'
import type { ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'
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
  'inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold ' +
  'transition-[transform,background-color,border-color,color,opacity] duration-200 ease-out-soft active:scale-[0.98] ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

const VARIANT_CLASS_NAMES: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-paper hover:bg-ink-soft',
  secondary: 'border border-line bg-white text-ink hover:border-ink/30',
  ghost: 'text-ink-soft hover:bg-paper-deep hover:text-ink',
}

const SIZE_CLASS_NAMES: Record<ButtonSize, string> = {
  md: 'h-12 px-6 text-[15px]',
  lg: 'h-14 px-8 text-[16px]',
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
  const classes = [
    BASE_CLASS_NAME,
    VARIANT_CLASS_NAMES[variant],
    SIZE_CLASS_NAMES[size],
    disabled ? 'pointer-events-none opacity-40' : '',
    className,
  ].join(' ')

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
