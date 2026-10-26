import localFont from 'next/font/local'
import { Patrick_Hand } from 'next/font/google'

// Playful screen faces, registered once by the root layout for the photobooth flow.
// Both ship a Vietnamese subset, so diacritics never fall back glyph by glyph.
export const bubbleFont = localFont({
  src: './assets/baloo-2-latin-vietnamese.woff2',
  variable: '--font-baloo',
  weight: '400 800',
  display: 'swap',
  // The numeral requires a quoted CSS family name in next/font/local's fallback list.
  fallback: ['"Baloo 2 Fallback"'],
  adjustFontFallback: false,
})

export const handFont = Patrick_Hand({
  variable: '--font-patrick-hand',
  subsets: ['latin', 'vietnamese'],
  weight: '400',
  // Decorative note only; never worth delaying the headline font for.
  preload: false,
})

// Only the fixed word on the decorative hero strip uses this tiny subset.
// Camera/error copy continues to use the complete Vietnamese Newsreader face.
export const printLabelFont = localFont({
  src: './assets/newsreader-print-label.woff2',
  variable: '--font-newsreader-label',
  weight: '400',
  style: 'italic',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
})
