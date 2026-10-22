import { ArrowRight } from 'lucide-react'
import Button from '@/src/features/photobooth/components/shared/controls/Button'
import PhotoComposition from '@/src/features/photobooth/components/shared/composition/PhotoComposition'
import BrandMark from '@/src/features/photobooth/components/shared/layout/BrandMark'
import ScreenShell from '@/src/features/photobooth/components/shared/layout/ScreenShell'
import { PHOTOBOOTH_ROUTES } from '@/src/features/photobooth/config/routes'

const PREVIEW_PRINTS = [
  { layoutId: 'grid-4', frameId: 'minimal', lookId: 'warm', className: '-rotate-6 translate-x-[18%] translate-y-[6%]' },
  { layoutId: 'vertical-4', frameId: 'editorial', lookId: 'mono', className: 'z-10' },
  { layoutId: 'grid-6', frameId: 'play', lookId: 'flash', className: 'rotate-6 -translate-x-[18%] translate-y-[8%]' },
] as const

export default function WelcomeScreen() {
  return (
    <ScreenShell>
      <header className="flex h-12 shrink-0 items-center">
        <BrandMark />
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-6 pt-4 md:flex-row md:items-center md:gap-12 short:flex-row short:items-center short:gap-8 short:pt-0">
        <section className="animate-rise flex shrink-0 flex-col md:w-[46%] short:w-[54%]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.24em] text-accent">Story-first photobooth</p>
          <h1 className="mt-4 font-display text-[clamp(40px,10vw,84px)] font-light leading-[0.98] tracking-[-0.02em] text-ink short:mt-2 short:text-[clamp(30px,5.4vw,44px)]">
            Mỗi khung hình là một <em className="font-normal italic text-accent">câu chuyện</em>.
          </h1>
          <p className="mt-5 max-w-[440px] text-[15px] leading-relaxed text-ink-soft sm:text-[16px] short:mt-3 short:text-[13px]">
            Chọn một trải nghiệm, nhìn vào camera — bố cục, ánh sáng và khung ảnh đã được sắp đặt sẵn. Tải ảnh về miễn phí ngay sau khi chụp.
          </p>
          <div className="mt-7 short:mt-4">
            <Button href={PHOTOBOOTH_ROUTES.EXPERIENCE} size="lg">
              Bắt đầu
              <ArrowRight aria-hidden="true" size={18} />
            </Button>
          </div>
        </section>

        <section aria-hidden="true" className="relative flex min-h-0 flex-1 items-center justify-center pb-6 short:pb-0">
          <div className="flex w-full max-w-[560px] items-center justify-center">
            {PREVIEW_PRINTS.map((print) => (
              <div
                key={print.layoutId}
                className={`w-[40%] shrink-0 shadow-[0_18px_40px_rgba(26,23,20,0.16)] ${print.className}`}
              >
                <PhotoComposition
                  layoutId={print.layoutId}
                  frameId={print.frameId}
                  lookId={print.lookId}
                  placeholder
                  imageSizes="200px"
                />
              </div>
            ))}
          </div>
        </section>
      </div>
    </ScreenShell>
  )
}
