import PhotoComposition, { PlaceholderShot } from '@/src/features/photobooth/components/shared/composition/PhotoComposition'
import { CameraSticker, Doodle, HeartSticker, StarSticker } from '@/src/features/photobooth/components/shared/brand/Stickers'

// Every piece is placed in percentages of the collage box (fixed aspect ratio),
// so the whole scene scales as one picture from 320px phones to wide desktops.

const PRINT_CARD =
  'overflow-hidden rounded-[6px] ring-4 ring-white shadow-[0_22px_40px_-14px_rgba(74,29,36,0.45)] sm:rounded-[10px] sm:ring-[6px]'

const STRIP_SHOTS = [0, 2, 1, 3]

/** A single cut strip, as handed out by a real booth. Sized in cqw of its wrapper. */
function PhotoStrip() {
  return (
    <div className="rounded-[6cqw] bg-[#1d1517] p-[7cqw] pb-0 shadow-[0_28px_44px_-14px_rgba(74,29,36,0.6)]">
      <div className="flex flex-col gap-[5cqw]">
        {STRIP_SHOTS.map((shot, index) => (
          <div key={index} className="relative aspect-4/3 overflow-hidden rounded-[2.5cqw] ring-1 ring-white/60">
            <PlaceholderShot index={shot} />
            {index === 0 ? (
              <svg viewBox="0 0 48 44" aria-hidden="true" className="absolute top-[10%] right-[8%] w-[20%] fill-none stroke-white" strokeWidth={4}>
                <path d="M24 40C24 40 5 29 5 15.5 5 9 9.8 4.5 15.6 4.5c3.8 0 6.8 2 8.4 5 1.6-3 4.6-5 8.4-5C38.2 4.5 43 9 43 15.5 43 29 24 40 24 40Z" />
              </svg>
            ) : null}
          </div>
        ))}
      </div>
      <p className="py-[6cqw] text-center font-display text-[14cqw] leading-none text-[#f4eee4] italic">Photobooth</p>
    </div>
  )
}

export default function HeroCollage({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`relative mx-auto aspect-20/19 w-full max-w-110 sm:max-w-130 split:max-w-150 short:max-w-80 ${className}`}>
      {/* Soft blob and pedestal the prints stand on. */}
      <div className="absolute inset-[8%_3%_12%_5%] rounded-[46%_54%_42%_58%/52%_44%_56%_48%] bg-linear-to-br from-[#fbd0da] to-[#fde9ee]" />
      <div className="absolute bottom-[3%] left-[14%] aspect-4/1 w-[72%]">
        <div className="absolute inset-x-0 bottom-0 h-[72%] rounded-[50%] bg-linear-to-b from-[#ee9fb2] to-[#de8098]" />
        <div className="absolute inset-x-0 top-0 h-[72%] rounded-[50%] bg-linear-to-b from-[#fde6eb] to-[#f7c3cf] shadow-[inset_0_-6px_14px_rgba(208,75,103,0.18)]" />
        <div className="absolute -inset-x-[8%] -inset-y-[18%] -rotate-6 rounded-[50%] border-2 border-accent/35" />
      </div>

      <div className="absolute top-[14%] left-[3%] w-[38%] -rotate-9">
        <div className={`animate-float [animation-delay:-1.2s] ${PRINT_CARD}`}>
          <PhotoComposition layoutId="grid-4" frameId="minimal" lookId="dreamy" placeholder imageSizes="220px" />
        </div>
      </div>

      <div className="absolute top-[17%] right-[3%] w-[38%] rotate-8">
        <div className={`animate-float [animation-delay:-2.6s] ${PRINT_CARD}`}>
          <PhotoComposition layoutId="grid-6" frameId="play" lookId="clean" placeholder imageSizes="220px" />
        </div>
      </div>

      <div className="@container absolute top-[1%] left-[35%] z-10 w-[30%] rotate-5">
        <div className="animate-float">
          <PhotoStrip />
        </div>
      </div>

      <div className="absolute bottom-[4%] left-0 z-20 w-[38%] -rotate-8">
        <CameraSticker className="w-full animate-float [animation-delay:-0.6s]" />
      </div>

      <HeartSticker className="absolute top-[3%] right-[9%] z-20 w-[13%] rotate-12 animate-float [animation-delay:-1.8s]" />
      <HeartSticker className="absolute bottom-[38%] left-[31%] z-30 w-[7%] -rotate-12" />
      <StarSticker className="absolute top-[42%] left-[1%] z-20 w-[10%] animate-float [animation-delay:-3s]" />
      <StarSticker className="absolute top-[54%] right-0 z-20 w-[12%] animate-float [animation-delay:-0.9s]" />
      <StarSticker className="absolute top-[20%] right-[31%] z-20 w-[6%]" />
      <Doodle className="absolute top-0 right-0 w-[9%] rotate-90" />
      <Doodle className="absolute top-[34%] left-[-2%] w-[8%] -rotate-12" />

      {/* Handwritten aside; only where there is room beside the copy. */}
      <p className="absolute right-[-2%] bottom-[-3%] z-30 hidden max-w-[34%] -rotate-8 font-hand text-[clamp(15px,1.35vw,20px)] leading-tight text-accent-deep split:block">
        Cùng một khoảnh khắc,
        <br />
        thêm nhiều câu chuyện ♡
      </p>
    </div>
  )
}
