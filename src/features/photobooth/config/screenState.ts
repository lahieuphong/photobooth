import { PHOTOBOOTH_ROUTES, type PhotoboothRoute } from '@/src/features/photobooth/config/routes'

export type PhotoboothScreen = {
  route: PhotoboothRoute
  step: number
  label: string
  backHref: PhotoboothRoute | null
}

/** Numbered steps after Welcome; Welcome itself is the cover and has no step. */
export const PHOTOBOOTH_SCREENS = {
  experience: { route: PHOTOBOOTH_ROUTES.EXPERIENCE, step: 1, label: 'Trải nghiệm', backHref: PHOTOBOOTH_ROUTES.WELCOME },
  ready: { route: PHOTOBOOTH_ROUTES.READY, step: 2, label: 'Chuẩn bị', backHref: PHOTOBOOTH_ROUTES.EXPERIENCE },
  capture: { route: PHOTOBOOTH_ROUTES.CAPTURE, step: 3, label: 'Chụp', backHref: PHOTOBOOTH_ROUTES.READY },
  // Captured photos can only be changed by retaking single shots, so Review has no way back.
  review: { route: PHOTOBOOTH_ROUTES.REVIEW, step: 4, label: 'Xem lại', backHref: null },
  studio: { route: PHOTOBOOTH_ROUTES.STUDIO, step: 5, label: 'Studio', backHref: PHOTOBOOTH_ROUTES.REVIEW },
  result: { route: PHOTOBOOTH_ROUTES.RESULT, step: 6, label: 'Kết quả', backHref: PHOTOBOOTH_ROUTES.STUDIO },
} satisfies Record<string, PhotoboothScreen>

export const PHOTOBOOTH_STEP_COUNT = 6
