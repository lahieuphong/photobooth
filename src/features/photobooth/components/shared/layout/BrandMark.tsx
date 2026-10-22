import Image from 'next/image'
import { getAssetPath } from '@/src/features/photobooth/utils/assetPath'

export default function BrandMark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Image
        src={getAssetPath('/images/logos/photobooth-mark.svg')}
        alt=""
        aria-hidden="true"
        width={28}
        height={28}
        priority
        className="h-7 w-7"
      />
      <span className="text-[12px] font-semibold uppercase tracking-[0.24em] text-ink">Photobooth</span>
    </span>
  )
}
