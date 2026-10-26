import type { PhotoboothExperienceId } from './experiences'
import { getAssetPath } from '@/src/features/photobooth/utils/assetPath'
import { DEMO_IMAGE_VARIANTS as variants } from './demoImageVariants'

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

/** Native picture sources for static export; the full master remains the largest candidate. */
export function getDemoPhotoSrcSets(experienceId: PhotoboothExperienceId): string[] {
  const originals: Record<string, number> = variants.photos
  return DEMO_PHOTOS[experienceId].map((photo) => {
    const name = `${experienceId}/${photo}`
    const width = originals[name]
    return [
      ...variants.widths.filter((candidate) => candidate < width)
        .map((candidate) => `${getAssetPath(`/images/demo/responsive/${name}-${candidate}.webp`)} ${candidate}w`),
      `${getAssetPath(`/images/demo/${name}.webp`)} ${width}w`,
    ].join(', ')
  })
}
