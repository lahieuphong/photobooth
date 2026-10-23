import Image from 'next/image'
import Link from 'next/link'
import { PHOTOBOOTH_ROUTES } from '@/src/features/photobooth/config/routes'
import { getAssetPath } from '@/src/features/photobooth/utils/assetPath'

/** Intrinsic size of public/images/logos/photobooth-logo.png. */
const LOGO_WIDTH = 635
const LOGO_HEIGHT = 605

type BrandMarkProps = {
  size?: 'header' | 'hero'
}

const SIZE_CLASS_NAMES: Record<NonNullable<BrandMarkProps['size']>, string> = {
  header: 'h-12',
  hero: 'h-[clamp(72px,12vh,112px)] short:h-14',
}

export default function BrandMark({ size = 'header' }: BrandMarkProps) {
  return (
    <Link
      href={PHOTOBOOTH_ROUTES.WELCOME}
      scroll={false}
      aria-label="Photobooth — về trang đầu"
      className="inline-flex shrink-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <Image
        src={getAssetPath('/images/logos/photobooth-logo.png')}
        alt="Photobooth"
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        priority
        sizes={size === 'hero' ? '120px' : '52px'}
        className={`w-auto ${SIZE_CLASS_NAMES[size]}`}
      />
    </Link>
  )
}
