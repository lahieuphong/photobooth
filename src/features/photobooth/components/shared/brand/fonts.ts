import { Baloo_2, Patrick_Hand } from 'next/font/google'

// Playful screen faces, shared by BrandPage across the photobooth flow.
// Both ship a Vietnamese subset, so diacritics never fall back glyph by glyph.
export const bubbleFont = Baloo_2({
  variable: '--font-baloo',
  subsets: ['latin', 'vietnamese'],
  weight: ['700', '800'],
})

export const handFont = Patrick_Hand({
  variable: '--font-patrick-hand',
  subsets: ['latin', 'vietnamese'],
  weight: '400',
  // Decorative note only; never worth delaying the headline font for.
  preload: false,
})
