import { Camera, Check, ChevronDown, ChevronRight, Heart, Lightbulb, ShieldCheck, Star } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { HeartSticker } from '@/src/features/photobooth/components/shared/brand/Stickers'
import PhotoComposition from '@/src/features/photobooth/components/shared/composition/PhotoComposition'
import type { PhotoboothExperience } from '@/src/features/photobooth/config/experiences'
import { PHOTOBOOTH_ROUTES } from '@/src/features/photobooth/config/routes'
import type { PhotoboothFrameId } from '@/src/features/photobooth/domain/frames'
import type { PhotoboothLayout } from '@/src/features/photobooth/domain/layouts'
import type { PhotoboothLookId } from '@/src/features/photobooth/domain/looks'

const TIPS = [
  'Đứng cách camera khoảng một sải tay',
  'Ánh sáng đủ và hướng về phía mặt',
  'Giữ máy ổn định',
  'Thoải mái tạo dáng theo phong cách của bạn',
]

const PERKS: Array<{ title: string; text: string; icon: ReactNode }> = [
  { title: 'Camera riêng tư', text: 'Hình ảnh chỉ được xử lý trong trình duyệt của bạn.', icon: <Camera aria-hidden="true" size={20} /> },
  { title: 'An toàn & bảo mật', text: 'Không tải ảnh lên máy chủ nào.', icon: <ShieldCheck aria-hidden="true" size={20} /> },
  { title: 'Trải nghiệm thú vị', text: 'Nhiều khung hình và tông màu xinh xắn.', icon: <Star aria-hidden="true" size={20} /> },
  { title: 'Dễ dàng sử dụng', text: 'Chỉ vài bước là có bộ ảnh hoàn chỉnh.', icon: <Heart aria-hidden="true" size={20} /> },
]

export const READY_CARD_CLASS_NAME =
  'rounded-[24px] bg-white/85 shadow-[0_14px_30px_-22px_rgba(74,29,36,0.45)] ring-1 ring-blush-deep/60'

type PresetSummaryProps = {
  experience: PhotoboothExperience
  layout: PhotoboothLayout
  frameId: PhotoboothFrameId
  lookId: PhotoboothLookId
  capturedCount: number
}

/** The session's experience; links back to Experience to pick another one. */
export function PresetSummary({ experience, layout, frameId, lookId, capturedCount }: PresetSummaryProps) {
  return (
    <Link
      href={PHOTOBOOTH_ROUTES.EXPERIENCE}
      scroll={false}
      aria-label={`Trải nghiệm ${experience.title}: ${experience.tagline}, ${experience.shotCount} ảnh, ${layout.label}. Đổi trải nghiệm`}
      className={`group flex items-center gap-4 p-3 transition-[translate,box-shadow] duration-200 ease-out-soft hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:p-4 ${READY_CARD_CLASS_NAME}`}
    >
      <span className="w-14 shrink-0 -rotate-3 overflow-hidden rounded-[4px] shadow-[0_8px_14px_-8px_rgba(74,29,36,0.5)] ring-2 ring-white transition-[rotate] group-hover:rotate-0 sm:w-16">
        <PhotoComposition layoutId={layout.id} frameId={frameId} lookId={lookId} placeholder imageSizes="64px" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="inline-block rounded-full bg-butter px-2.5 py-0.5 text-[11px] font-bold tracking-[0.12em] text-accent-deep uppercase">
          {experience.title}
        </span>
        <span className="mt-1 block font-bubble text-[17px] leading-tight font-bold text-cocoa sm:text-[19px]">{experience.tagline}</span>
        <span className="mt-0.5 block text-[13px] text-ink-soft">
          {experience.shotCount} ảnh · {layout.label}
          {capturedCount > 0 ? ` · đã chụp ${capturedCount}` : ''}
        </span>
      </span>
      <ChevronRight aria-hidden="true" size={20} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}

function TipList() {
  return (
    <ul className="flex flex-col gap-2.5">
      {TIPS.map((tip) => (
        <li key={tip} className="flex items-start gap-2.5 text-[14px] leading-snug text-cocoa/85">
          <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent text-white">
            <Check aria-hidden="true" size={12} strokeWidth={3} />
          </span>
          {tip}
        </li>
      ))}
    </ul>
  )
}

/** A static card where there is room beside the camera (xl), a collapsible one elsewhere. */
export function ReadyTips({ className = '' }: { className?: string }) {
  return (
    <div className={className}>
      <details className="group rounded-[24px] bg-butter/80 ring-1 ring-cream xl:hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-[24px] px-4 font-bubble text-[17px] font-bold text-cocoa focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
          <Lightbulb aria-hidden="true" size={18} className="text-accent" />
          Gợi ý nhỏ
          <ChevronDown aria-hidden="true" size={18} className="ml-auto text-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-4 pb-4">
          <TipList />
        </div>
      </details>

      <section
        aria-labelledby="ready-tips-title"
        className="relative hidden -rotate-1 rounded-[28px] bg-butter p-5 shadow-[0_18px_32px_-22px_rgba(74,29,36,0.5)] ring-1 ring-cream xl:block"
      >
        <h2 id="ready-tips-title" className="mb-4 flex items-center gap-2 font-bubble text-[19px] font-bold text-cocoa">
          <Lightbulb aria-hidden="true" size={19} className="text-accent" />
          Gợi ý nhỏ
        </h2>
        <TipList />
        <HeartSticker className="absolute -right-3 -bottom-4 w-11 rotate-12" />
      </section>
    </div>
  )
}

export function ReadyPerks({ className = '' }: { className?: string }) {
  return (
    <ul className={`grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4 ${className}`}>
      {PERKS.map((perk) => (
        <li key={perk.title} className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-accent shadow-[0_8px_16px_-10px_rgba(176,58,85,0.7)] ring-1 ring-blush-deep">
            {perk.icon}
          </span>
          <span>
            <span className="block font-bubble text-[16px] font-bold text-cocoa">{perk.title}</span>
            <span className="block text-[13px] leading-snug text-ink-soft">{perk.text}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
