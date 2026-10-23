import { ArrowRight, Gift, ShieldCheck, Smartphone } from 'lucide-react'
import type { ReactNode } from 'react'
import Button from '@/src/features/photobooth/components/shared/controls/Button'
import PhotoComposition from '@/src/features/photobooth/components/shared/composition/PhotoComposition'
import { PHOTOBOOTH_EXPERIENCES } from '@/src/features/photobooth/config/experiences'
import { PHOTOBOOTH_ROUTES } from '@/src/features/photobooth/config/routes'
import { getFrame, type PhotoboothFrameId } from '@/src/features/photobooth/domain/frames'
import type { PhotoboothLayoutId } from '@/src/features/photobooth/domain/layouts'
import { PHOTOBOOTH_LOOKS, type PhotoboothLookId } from '@/src/features/photobooth/domain/looks'
import { HeartSticker, StarSticker } from './Stickers'
import { WELCOME_CONTAINER } from './welcomeLayout'

// Below-the-fold sections the nav links scroll to. Content comes from the same
// config as the capture flow, so a new experience, frame or look shows up here too.

const SECTION_CLASS_NAME = 'relative scroll-mt-20 py-16 focus:outline-none sm:scroll-mt-24 sm:py-20 lg:scroll-mt-28 lg:py-24'

const TILE_TONES = ['bg-blush', 'bg-butter', 'bg-[#e8f1e9]', 'bg-[#ece8f6]', 'bg-[#e2eef3]']

const FRAME_SAMPLES: Array<{ frameId: PhotoboothFrameId; layoutId: PhotoboothLayoutId; lookId: PhotoboothLookId; tilt: string }> = [
  { frameId: 'minimal', layoutId: 'grid-4', lookId: 'warm', tilt: '-rotate-3' },
  { frameId: 'editorial', layoutId: 'vertical-4', lookId: 'mono', tilt: 'rotate-0' },
  { frameId: 'play', layoutId: 'grid-6', lookId: 'flash', tilt: 'rotate-3' },
]

const VALUES = [
  {
    title: 'Riêng tư',
    text: 'Ảnh chỉ được lưu trong trình duyệt trên máy của bạn, không tải lên máy chủ nào.',
    icon: <ShieldCheck aria-hidden="true" size={22} />,
  },
  {
    title: 'Không cần cài đặt',
    text: 'Mở trên điện thoại, máy tính bảng hay laptop là chụp được ngay.',
    icon: <Smartphone aria-hidden="true" size={22} />,
  },
  {
    title: 'Miễn phí',
    text: 'Tải ảnh về máy ngay sau khi chụp, không cần tạo tài khoản.',
    icon: <Gift aria-hidden="true" size={22} />,
  },
]

type SectionHeadingProps = {
  id: string
  eyebrow: string
  title: string
  children?: ReactNode
  align?: 'center' | 'start'
}

function SectionHeading({ id, eyebrow, title, children, align = 'center' }: SectionHeadingProps) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-xl text-center' : 'max-w-xl'}>
      <p className="text-[11px] font-semibold tracking-[0.24em] text-accent-deep uppercase">{eyebrow}</p>
      <h2 id={id} className="mt-3 font-bubble text-[clamp(28px,7vw,44px)] leading-[1.15] font-extrabold text-balance text-cocoa">
        {title}
      </h2>
      {children ? <p className="mt-3 text-[15px] leading-relaxed text-ink-soft sm:text-[16px]">{children}</p> : null}
    </div>
  )
}

export function ExperienceShowcase() {
  return (
    <section id="trai-nghiem" tabIndex={-1} aria-labelledby="trai-nghiem-title" className={`${SECTION_CLASS_NAME} bg-paper`}>
      <div className={WELCOME_CONTAINER}>
        <SectionHeading id="trai-nghiem-title" eyebrow="Trải nghiệm" title="Chọn một câu chuyện để kể">
          Mỗi trải nghiệm có sẵn bố cục, số kiểu ảnh và gợi ý tạo dáng — bạn chỉ cần nhìn vào camera.
        </SectionHeading>

        <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-5">
          {PHOTOBOOTH_EXPERIENCES.map((experience, index) => (
            <li
              key={experience.id}
              className="group flex flex-col rounded-[28px] bg-white p-2.5 shadow-[0_14px_30px_-18px_rgba(176,58,85,0.45)] ring-1 ring-blush-deep/60 transition-[translate,box-shadow] duration-300 ease-out-soft hover:-translate-y-1 hover:shadow-[0_22px_36px_-18px_rgba(176,58,85,0.55)] sm:p-3"
            >
              <div className={`flex aspect-4/5 items-center justify-center rounded-[22px] ${TILE_TONES[index % TILE_TONES.length]}`}>
                <div className="w-[64%] -rotate-3 overflow-hidden rounded-[4px] shadow-[0_12px_20px_-10px_rgba(74,29,36,0.45)] transition-[rotate] duration-300 ease-out-soft group-hover:rotate-0">
                  <PhotoComposition
                    layoutId={experience.layoutId}
                    frameId={experience.defaultFrameId}
                    lookId={experience.defaultLookId}
                    placeholder
                    imageSizes="160px"
                  />
                </div>
              </div>
              <div className="flex flex-1 flex-col px-1.5 pt-3 pb-1.5">
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <h3 className="font-bubble text-[18px] leading-tight font-bold text-cocoa sm:text-[20px]">{experience.title}</h3>
                  <span className="rounded-full bg-blush px-2.5 py-0.5 text-[11px] font-semibold text-accent-deep">
                    {experience.shotCount} ảnh
                  </span>
                </div>
                <p className="mt-1 text-[13px] leading-snug text-ink-soft">{experience.tagline}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex justify-center">
          <Button href={PHOTOBOOTH_ROUTES.EXPERIENCE} variant="candy" size="lg">
            Chọn trải nghiệm
            <ArrowRight aria-hidden="true" size={18} />
          </Button>
        </div>
      </div>
    </section>
  )
}

export function FrameShowcase() {
  return (
    <section
      id="mau-khung"
      tabIndex={-1}
      aria-labelledby="mau-khung-title"
      className={`${SECTION_CLASS_NAME} overflow-hidden bg-linear-to-b from-paper via-petal to-paper`}
    >
      <div className={WELCOME_CONTAINER}>
        <SectionHeading id="mau-khung-title" eyebrow="Mẫu khung hình" title="Khung ảnh cho mọi tâm trạng">
          Đổi khung và tông màu bất cứ lúc nào sau khi chụp — ảnh gốc luôn được giữ nguyên.
        </SectionHeading>

        <div className="relative mx-auto mt-12 max-w-4xl">
          <HeartSticker className="absolute -top-6 left-[-2%] z-10 w-8 -rotate-12 sm:w-12" />
          <StarSticker className="absolute right-[-2%] -bottom-4 z-10 w-8 sm:w-12" />
          <ul className="grid grid-cols-3 gap-3 sm:gap-8">
            {FRAME_SAMPLES.map(({ frameId, layoutId, lookId, tilt }) => {
              const frame = getFrame(frameId)
              return (
                <li key={frameId} className="flex flex-col items-center text-center">
                  <div
                    className={`w-full overflow-hidden rounded-[6px] shadow-[0_22px_40px_-18px_rgba(74,29,36,0.45)] ring-4 ring-white transition-[rotate,translate] duration-300 ease-out-soft hover:-translate-y-1 hover:rotate-0 sm:rounded-[10px] sm:ring-[6px] ${tilt}`}
                  >
                    <PhotoComposition layoutId={layoutId} frameId={frameId} lookId={lookId} placeholder imageSizes="(max-width: 640px) 30vw, 280px" />
                  </div>
                  <h3 className="mt-5 font-bubble text-[16px] font-bold text-cocoa sm:text-[20px]">{frame.label}</h3>
                  <p className="mt-1 hidden text-[13px] text-ink-soft sm:block">{frame.description}</p>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="mt-12 flex flex-col items-center gap-3">
          <p className="text-[13px] font-medium text-ink-soft">Kèm {PHOTOBOOTH_LOOKS.length} tông màu để đổi không khí:</p>
          <ul className="flex flex-wrap justify-center gap-2">
            {PHOTOBOOTH_LOOKS.map((look) => (
              <li
                key={look.id}
                title={look.description}
                className="rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-cocoa shadow-[0_4px_0_#f3d3db] ring-1 ring-blush-deep"
              >
                {look.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

export function AboutSection() {
  return (
    <section id="ve-chung-minh" tabIndex={-1} aria-labelledby="ve-chung-minh-title" className={`${SECTION_CLASS_NAME} bg-paper`}>
      <div className={WELCOME_CONTAINER}>
        <div className="relative overflow-hidden rounded-[36px] bg-linear-to-br from-blush via-petal to-butter p-6 ring-1 ring-blush-deep/60 sm:p-10 lg:grid lg:grid-cols-[1fr_1.15fr] lg:items-center lg:gap-12 lg:p-14">
          <StarSticker className="absolute top-6 right-6 w-8 sm:w-10" />
          <SectionHeading id="ve-chung-minh-title" eyebrow="Về chúng mình" title="Một góc chụp nhỏ cho những câu chuyện lớn" align="start">
            Photobooth ra đời từ một ý tưởng đơn giản: ai cũng có những khoảnh khắc đáng giữ lại. Chúng mình lo phần bố cục, ánh
            sáng và khung ảnh để bạn chỉ việc tận hưởng.
          </SectionHeading>

          <ul className="mt-8 grid gap-3 sm:grid-cols-3 lg:mt-0 lg:grid-cols-1">
            {VALUES.map((value) => (
              <li key={value.title} className="flex gap-4 rounded-3xl bg-white/80 p-4 shadow-[0_10px_24px_-18px_rgba(176,58,85,0.6)] sm:flex-col lg:flex-row">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-blush text-accent ring-4 ring-white">{value.icon}</span>
                <div>
                  <h3 className="font-bubble text-[17px] font-bold text-cocoa">{value.title}</h3>
                  <p className="mt-0.5 text-[14px] leading-relaxed text-ink-soft">{value.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
