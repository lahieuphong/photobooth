// Hand-drawn stickers in the logo's style: berry fill, cocoa outline and a white
// sticker edge (a fat white stroke painted under each shape). All decorative.

type StickerProps = {
  className?: string
}

const HEART_PATH =
  'M24 40C24 40 5 29 5 15.5 5 9 9.8 4.5 15.6 4.5c3.8 0 6.8 2 8.4 5 1.6-3 4.6-5 8.4-5C38.2 4.5 43 9 43 15.5 43 29 24 40 24 40Z'

const SPARKLE_PATH =
  'M24 3c1.8 10.2 5.8 15.2 21 21-15.2 5.8-19.2 10.8-21 21-1.8-10.2-5.8-15.2-21-21 15.2-5.8 19.2-10.8 21-21Z'

const STICKER_SHADOW = 'overflow-visible drop-shadow-[0_6px_6px_rgba(74,29,36,0.2)]'

export function HeartSticker({ className = '' }: StickerProps) {
  return (
    <svg viewBox="0 0 48 44" aria-hidden="true" className={`${STICKER_SHADOW} ${className}`}>
      <path d={HEART_PATH} className="fill-white stroke-white" strokeWidth={8} strokeLinejoin="round" />
      <path d={HEART_PATH} className="fill-accent stroke-cocoa" strokeWidth={2.4} strokeLinejoin="round" />
      <ellipse cx={15} cy={14} rx={4.5} ry={2.8} transform="rotate(-35 15 14)" className="fill-white/80" />
    </svg>
  )
}

export function StarSticker({ className = '' }: StickerProps) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={`${STICKER_SHADOW} ${className}`}>
      <path d={SPARKLE_PATH} className="fill-white stroke-white" strokeWidth={8} strokeLinejoin="round" />
      <path d={SPARKLE_PATH} className="fill-sunny stroke-cocoa" strokeWidth={2.4} strokeLinejoin="round" />
      <ellipse cx={21} cy={17} rx={1.8} ry={3.6} transform="rotate(20 21 17)" className="fill-white/80" />
    </svg>
  )
}

/** Three "pop" dashes like the ones beside the logo's polaroid. */
export function Doodle({ className = '' }: StickerProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" className={className}>
      <g className="stroke-accent" strokeWidth={3.5} strokeLinecap="round">
        <path d="M4 25l11 2" />
        <path d="M9 8l8.5 9" />
        <path d="M27 3v11" />
      </g>
    </svg>
  )
}

/** The logo's camera with its heart polaroid, redrawn as a vector sticker. */
export function CameraSticker({ className = '' }: StickerProps) {
  const polaroid = 'rotate(10 127 70)'

  return (
    <svg viewBox="0 0 164 120" aria-hidden="true" className={`${STICKER_SHADOW} ${className}`}>
      <g className="fill-white stroke-white" strokeWidth={12} strokeLinejoin="round">
        <rect x={30} y={14} width={34} height={18} rx={5} />
        <rect x={10} y={26} width={112} height={78} rx={16} />
        <rect x={104} y={44} width={46} height={52} rx={4} transform={polaroid} />
      </g>

      <g className="stroke-cocoa" strokeWidth={3.5} strokeLinejoin="round">
        <rect x={30} y={14} width={34} height={18} rx={5} className="fill-white" />
        <rect x={10} y={26} width={112} height={78} rx={16} className="fill-white" />
        <path d="M10 62h112v26a16 16 0 0 1-16 16H26a16 16 0 0 1-16-16Z" className="fill-accent" />
        <rect x={20} y={36} width={18} height={10} rx={3} className="fill-cream" />
        <rect x={96} y={36} width={16} height={9} rx={3} className="fill-cream" />
        <circle cx={66} cy={64} r={28} className="fill-accent" />
        <circle cx={66} cy={64} r={18} className="fill-cream" />
      </g>
      <ellipse cx={59} cy={56} rx={6} ry={3.8} transform="rotate(-30 59 56)" className="fill-white" />

      <g transform={polaroid} className="stroke-cocoa" strokeWidth={3.5} strokeLinejoin="round">
        <rect x={104} y={44} width={46} height={52} rx={4} className="fill-white" />
        <rect x={110} y={50} width={34} height={32} rx={2} className="fill-cream" />
        <path d={HEART_PATH} transform="translate(117.4 57.4) scale(0.4)" strokeWidth={6} className="fill-accent" />
      </g>
    </svg>
  )
}
