import type { PhotoboothFrameId } from '@/src/features/photobooth/domain/frames'
import type { PhotoboothLayoutId } from '@/src/features/photobooth/domain/layouts'
import type { PhotoboothLookId } from '@/src/features/photobooth/domain/looks'

// Adding an experience only requires a new entry here: session creation, capture
// prompts and Studio defaults all read from this list.

export type PhotoboothExperienceId = 'quick-4' | 'editorial' | 'duo' | 'story-6' | 'play'

export type PhotoboothExperience = {
  id: PhotoboothExperienceId
  title: string
  tagline: string
  description: string
  shotCount: number
  layoutId: PhotoboothLayoutId
  defaultLookId: PhotoboothLookId
  defaultFrameId: PhotoboothFrameId
  /** One short posing hint per shot, in capture order. */
  prompts: string[]
}

export const PHOTOBOOTH_EXPERIENCES: PhotoboothExperience[] = [
  {
    id: 'quick-4',
    title: 'Quick 4',
    tagline: 'Nhanh, gọn, tự nhiên',
    description: '4 khoảnh khắc trong chưa đầy một phút.',
    shotCount: 4,
    layoutId: 'grid-4',
    defaultLookId: 'clean',
    defaultFrameId: 'minimal',
    prompts: ['Nhìn vào camera', 'Cười thật tự nhiên', 'Đổi một góc mặt', 'Tạo dáng yêu thích'],
  },
  {
    id: 'editorial',
    title: 'Editorial',
    tagline: 'Thần thái trang bìa',
    description: 'Dải ảnh dọc phong cách tạp chí thời trang.',
    shotCount: 4,
    layoutId: 'vertical-4',
    defaultLookId: 'mono',
    defaultFrameId: 'editorial',
    prompts: ['Giữ ánh nhìn tự tin', 'Nghiêng nhẹ vai', 'Thử một biểu cảm khác', 'Tạo dáng cuối cùng'],
  },
  {
    id: 'duo',
    title: 'Duo',
    tagline: 'Hai người, một khung hình',
    description: 'Gợi ý tạo dáng cho bạn và người đồng hành.',
    shotCount: 4,
    layoutId: 'grid-4',
    defaultLookId: 'warm',
    defaultFrameId: 'minimal',
    prompts: ['Đứng sát vào nhau', 'Nhìn nhau và cười', 'Tạo dáng đối xứng', 'Một cái ôm thật chặt'],
  },
  {
    id: 'story-6',
    title: 'Story 6',
    tagline: 'Kể chuyện bằng 6 khung hình',
    description: 'Mở đầu, cao trào và kết thúc — trọn một câu chuyện.',
    shotCount: 6,
    layoutId: 'grid-6',
    defaultLookId: 'warm',
    defaultFrameId: 'editorial',
    prompts: [
      'Mở đầu: chào camera',
      'Một khoảnh khắc bất ngờ',
      'Cao trào: biểu cảm mạnh nhất',
      'Chậm lại, nhìn xa xăm',
      'Một chi tiết nhỏ thật gần',
      'Kết thúc: vẫy tay tạm biệt',
    ],
  },
  {
    id: 'play',
    title: 'Play',
    tagline: 'Vui hết cỡ',
    description: 'Nhiều năng lượng, biểu cảm càng lố càng vui.',
    shotCount: 4,
    layoutId: 'grid-4',
    defaultLookId: 'flash',
    defaultFrameId: 'play',
    prompts: ['Làm mặt hài hước nhất', 'Nhảy lên!', 'Tạo dáng siêu anh hùng', 'Cười thật to'],
  },
]

export function getExperience(id: PhotoboothExperienceId): PhotoboothExperience {
  return PHOTOBOOTH_EXPERIENCES.find((experience) => experience.id === id) ?? PHOTOBOOTH_EXPERIENCES[0]
}

export function isExperienceId(value: unknown): value is PhotoboothExperienceId {
  return PHOTOBOOTH_EXPERIENCES.some((experience) => experience.id === value)
}
