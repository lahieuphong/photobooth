'use client'

import type { MouseEvent, ReactNode } from 'react'
import type { WelcomeSectionId } from './siteLayout'

type SectionLinkProps = {
  to: WelcomeSectionId
  children: ReactNode
  className?: string
  onNavigate?: () => void
  'aria-current'?: 'true'
}

/**
 * In-page link that scrolls without adding a `#hash` history entry: the app
 * router ignores entries it did not create, so Back from the next screen would
 * land on one and leave the old screen showing.
 */
export default function SectionLink({ to, children, className = '', onNavigate, ...rest }: SectionLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    // Let the browser handle "open in new tab" and similar modified clicks.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const target = document.getElementById(to)
    if (!target) return

    event.preventDefault()
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
    // Sections are focusable (tabIndex -1), so keyboard and screen reader users follow along.
    target.focus({ preventScroll: true })
    onNavigate?.()
  }

  return (
    <a href={`#${to}`} onClick={handleClick} className={className} {...rest}>
      {children}
    </a>
  )
}
