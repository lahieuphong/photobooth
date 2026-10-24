import type { ReactNode } from 'react'

type BubbleHeadingProps = {
  id?: string
  as?: 'h1' | 'h2'
  /** Font size, weight and color; the outline scales with the font size. */
  className?: string
  children: ReactNode
  /** Absolutely positioned stickers, placed relative to the text box. */
  decorations?: ReactNode
}

/**
 * Sticker-style headline. A stroked copy sits under the real heading in the same
 * grid cell (see `.bubble-text` in globals.css), so the outline never eats into the
 * glyphs. The copy is a sibling, not a child, so the heading text exists only once
 * for screen readers, search engines and copy-paste.
 */
export default function BubbleHeading({ id, as: Heading = 'h1', className = '', children, decorations }: BubbleHeadingProps) {
  return (
    <div className={`bubble-text relative w-fit ${className}`}>
      <p aria-hidden="true" className="bubble-text__outline select-none">
        {children}
      </p>
      <Heading id={id} className="relative">
        {children}
      </Heading>
      {decorations}
    </div>
  )
}
