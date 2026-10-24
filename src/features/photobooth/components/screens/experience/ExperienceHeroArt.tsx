import { CameraSticker, Doodle, HeartSticker, StarSticker } from '@/src/features/photobooth/components/shared/brand/Stickers'
import { PlaceholderShot } from '@/src/features/photobooth/components/shared/composition/PhotoComposition'

const POLAROID_CLASS_NAME =
  'absolute w-[21%] rounded-[4px] bg-white p-[1.6%] pb-[5%] shadow-[0_16px_28px_-14px_rgba(74,29,36,0.45)]'

/** Camera, two polaroids and a handwritten note beside the heading; desktop only. */
export default function ExperienceHeroArt({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`relative aspect-[2.3/1] w-full max-w-108 ${className}`}>
      <div className={`${POLAROID_CLASS_NAME} top-[10%] left-[34%] -rotate-8`}>
        <div className="relative aspect-square overflow-hidden rounded-[2px]">
          <PlaceholderShot index={2} />
        </div>
      </div>
      <div className={`${POLAROID_CLASS_NAME} top-[16%] left-[50%] rotate-8`}>
        <div className="relative aspect-square overflow-hidden rounded-[2px]">
          <PlaceholderShot index={1} />
        </div>
      </div>

      <div className="absolute bottom-[2%] left-[6%] w-[38%] -rotate-6">
        <CameraSticker className="w-full animate-float" />
      </div>
      <StarSticker className="absolute top-0 left-[24%] w-[9%] animate-float [animation-delay:-1.6s]" />
      <HeartSticker className="absolute right-[26%] bottom-[8%] w-[7%] rotate-12" />
      <Doodle className="absolute top-[-4%] left-[62%] w-[7%] rotate-90" />

      <p className="absolute top-[8%] right-0 w-[27%] -rotate-6 font-hand text-[clamp(15px,1.3vw,19px)] leading-tight text-accent-deep">
        Cùng lưu giữ những khoảnh khắc thật bạn nhé! ♡
      </p>
    </div>
  )
}
