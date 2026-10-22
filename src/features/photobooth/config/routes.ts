export const PHOTOBOOTH_ROUTES = {
  HOME: '/',
  WELCOME: '/welcome',
  EXPERIENCE: '/experience',
  READY: '/ready',
  CAPTURE: '/capture',
  REVIEW: '/review',
  STUDIO: '/studio',
  RESULT: '/result',
} as const

export type PhotoboothRoute = (typeof PHOTOBOOTH_ROUTES)[keyof typeof PHOTOBOOTH_ROUTES]
