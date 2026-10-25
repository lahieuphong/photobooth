import { ArrowDown, ArrowRight, Camera, Heart, Play, Sparkles, Star } from 'lucide-react'
import type { ReactNode } from 'react'
import BubbleHeading from '@/src/features/photobooth/components/shared/brand/BubbleHeading'
import PastelBackdrop from '@/src/features/photobooth/components/shared/brand/PastelBackdrop'
import { Doodle, HeartSticker } from '@/src/features/photobooth/components/shared/brand/Stickers'
import Button, { getButtonClassName } from '@/src/features/photobooth/components/shared/controls/Button'
import SectionLink from '@/src/features/photobooth/components/shared/layout/SectionLink'
import { SITE_CONTAINER } from '@/src/features/photobooth/components/shared/layout/siteLayout'
import { PHOTOBOOTH_ROUTES } from '@/src/features/photobooth/config/routes'
import HeroCollage from './HeroCollage'

const PERKS: Array<{ label: string; icon: ReactNode; tone: string }> = [
  {
    label: 'Nhiều mẫu khung độc đáo',
    icon: <Camera aria-hidden="true" size={22} />,
    tone: 'bg-blush text-accent',
  },
  {
    label: 'Chụp dễ dàng trong vài giây',
    icon: <Star aria-hidden="true" size={22} className="fill-sunny" />,
    tone: 'bg-butter text-[#c7891a]',
  },
  {
    label: 'Tải ảnh miễn phí chất lượng cao',
    icon: <Heart aria-hidden="true" size={22} />,
    tone: 'bg-blush text-accent',
  },
]

const HEADLINE = (
  <>
    <span className="block">Mỗi khung hình</span>
    <span className="block">là một</span>
    <span className="block text-accent">
      câu chuyện<span className="text-cocoa">.</span>
    </span>
  </>
)

export default function WelcomeHero() {
  return (
    <section
      id="trang-chu"
      tabIndex={-1}
      aria-labelledby="welcome-title"
      className="relative isolate scroll-mt-20 overflow-hidden focus:outline-none sm:scroll-mt-24 lg:scroll-mt-28"
    >
      <PastelBackdrop ambient />

      <div
        className={`${SITE_CONTAINER} flex flex-col items-center pt-4 pb-16 sm:pt-8 sm:pb-24 split:grid split:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] split:items-center split:gap-x-6 lg:min-h-[min(calc(100svh-6rem),60rem)] lg:gap-x-12 lg:pt-6 lg:pb-32 short:pt-2 short:pb-14`}
      >
        {/* On phones these children interleave with the collage (via `order`); side by side they form one column. */}
        <div className="contents split:flex split:flex-col split:items-start">
          <div className="order-1 flex flex-col items-center text-center split:items-start split:text-left">
            <p className="motion-fade inline-flex items-center gap-2 rounded-full bg-white/75 px-4 py-1.5 text-[11px] font-semibold tracking-[0.24em] text-accent-deep uppercase shadow-[0_6px_16px_-10px_rgba(176,58,85,0.6)] ring-1 ring-blush-deep">
              <Sparkles aria-hidden="true" size={13} />
              Story-first photobooth
            </p>

            <BubbleHeading
              id="welcome-title"
              className="motion-lines mt-5 font-bubble text-[clamp(34px,11.4vw,60px)] leading-[1.14] font-extrabold tracking-[-0.01em] text-cocoa sm:text-[68px] split:mt-6 lg:text-[clamp(56px,5.3vw,82px)] short:mt-3 short:text-[clamp(30px,5.6vw,42px)]"
              decorations={
                <>
                  <HeartSticker className="absolute top-[34%] right-[-0.2em] w-[0.6em] rotate-12 split:right-[-0.7em]" />
                  <Doodle className="absolute bottom-[6%] left-[-0.75em] hidden w-[0.55em] -scale-x-100 rotate-180 xl:block" />
                </>
              }
            >
              {HEADLINE}
            </BubbleHeading>

            <p className="motion-fade [animation-delay:120ms] mt-4 max-w-132 text-[15px] leading-relaxed text-ink-soft sm:text-[17px] split:mt-5 short:mt-3 short:text-[14px]">
              Chọn một trải nghiệm, nhìn vào camera — bố cục, ánh sáng và khung ảnh đã được sắp đặt sẵn. Tải ảnh về miễn phí ngay sau khi chụp.
            </p>
          </div>

          <div className="order-3 mt-8 flex w-full max-w-sm animate-rise flex-col gap-3 [animation-delay:160ms] sm:w-auto sm:max-w-none sm:flex-row split:mt-8 short:mt-5">
            <Button href={PHOTOBOOTH_ROUTES.EXPERIENCE} variant="candy" size="lg" className="w-full sm:w-auto sm:min-w-44">
              Bắt đầu
              <ArrowRight aria-hidden="true" size={18} />
            </Button>
            <SectionLink to="trai-nghiem" className={getButtonClassName({ variant: 'bubble', size: 'lg', className: 'w-full pl-3 sm:w-auto' })}>
              <span className="grid size-8 place-items-center rounded-full bg-accent text-white">
                <Play aria-hidden="true" size={14} className="ml-0.5 fill-current" />
              </span>
              Xem trải nghiệm
            </SectionLink>
          </div>

          <ul className="order-4 mt-9 grid w-full max-w-md animate-rise grid-cols-3 gap-2 [animation-delay:240ms] sm:gap-4 split:mt-10 split:max-w-120 short:mt-6">
            {PERKS.map((perk) => (
              <li key={perk.label} className="flex flex-col items-center gap-2 text-center">
                <span
                  className={`grid size-12 place-items-center rounded-full shadow-[inset_0_-4px_0_rgba(74,29,36,0.06),0_10px_18px_-12px_rgba(176,58,85,0.7)] ring-4 ring-white/70 sm:size-14 ${perk.tone}`}
                >
                  {perk.icon}
                </span>
                <span className="max-w-36 text-[12px] leading-snug font-medium text-balance text-ink-soft sm:text-[13px]">{perk.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <HeroCollage className="order-2 mt-8 motion-paper [animation-delay:180ms] sm:mt-10 split:order-none split:mt-0" />
      </div>

      <SectionLink
        to="trai-nghiem"
        className="absolute inset-x-0 bottom-10 mx-auto hidden w-fit flex-col items-center gap-1.5 rounded-full px-4 py-2 text-[11px] font-semibold tracking-[0.24em] text-cocoa/75 uppercase transition-colors hover:text-accent-deep focus-visible:outline-2 focus-visible:outline-accent md:flex short:hidden"
      >
        Khám phá trải nghiệm
        <ArrowDown aria-hidden="true" size={18} className="animate-nudge" />
      </SectionLink>

      {/* Soft paper edge into the next section. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 1440 64"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 -bottom-px h-8 w-full text-paper sm:h-12"
      >
        <path fill="currentColor" d="M0 34C160 12 300 6 450 20s290 38 450 34 330-38 540-30V64H0Z" />
      </svg>
    </section>
  )
}
