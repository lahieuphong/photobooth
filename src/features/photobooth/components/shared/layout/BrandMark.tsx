import Image from 'next/image'
import Link from 'next/link'
import { PHOTOBOOTH_ROUTES } from '@/src/features/photobooth/config/routes'
import { getAssetPath } from '@/src/features/photobooth/utils/assetPath'

/** Intrinsic size of public/images/logos/photobooth-logo.png. */
const LOGO_WIDTH = 635
const LOGO_HEIGHT = 605

type BrandMarkProps = {
  size?: 'header' | 'hero' | 'nav'
}

const SIZE_CLASS_NAMES: Record<NonNullable<BrandMarkProps['size']>, string> = {
  header: 'h-12',
  hero: 'h-[clamp(72px,12vh,112px)] short:h-14',
  nav: 'h-12 sm:h-14 lg:h-19 short:h-10',
}

const SIZES: Record<NonNullable<BrandMarkProps['size']>, string> = {
  header: '52px',
  hero: '120px',
  nav: '80px',
}

export default function BrandMark({ size = 'header' }: BrandMarkProps) {
  return (
    <Link
      href={PHOTOBOOTH_ROUTES.WELCOME}
      scroll={false}
      aria-label="Photobooth — về trang đầu"
      className="inline-flex shrink-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <picture className="contents">
        <source
          srcSet={`${getAssetPath('/images/logos/photobooth-logo-160.webp')} 160w, ${getAssetPath('/images/logos/photobooth-logo-320.webp')} 320w, ${getAssetPath('/images/logos/photobooth-logo.png')} ${LOGO_WIDTH}w`}
          sizes={SIZES[size]}
        />
        <Image
          src={getAssetPath('/images/logos/photobooth-logo.png')}
          alt="Photobooth"
          width={LOGO_WIDTH}
          height={LOGO_HEIGHT}
          loading="eager"
          sizes={SIZES[size]}
          className={`w-auto ${SIZE_CLASS_NAMES[size]}`}
          style={{ aspectRatio: `${LOGO_WIDTH} / ${LOGO_HEIGHT}` }}
        />
      </picture>
    </Link>
  )
}
