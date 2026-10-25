import type { PhotoboothExperienceId } from './experiences'
import { getAssetPath } from '@/src/features/photobooth/utils/assetPath'

// Marketing samples only. Never use these URLs to fill missing session photos.
const DEMO_PHOTOS: Record<PhotoboothExperienceId, string[]> = {
  'quick-4': ['01', '02', '03', '04'],
  editorial: ['01', '02', '03', '04'],
  duo: ['01', '02', '03', '04'],
  'story-6': ['01', '02', '03', '04', '05', '06'],
  play: ['01', '02', '03', '04'],
}

export function getDemoPhotoUrls(experienceId: PhotoboothExperienceId): string[] {
  return DEMO_PHOTOS[experienceId].map((photo) => getAssetPath(`/images/demo/${experienceId}/${photo}.webp`))
}
