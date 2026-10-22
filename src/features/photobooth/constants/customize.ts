export type PhotoboothFilterOption = {
  id: string
  name: string
  previewClassName: string
}

export type PhotoboothBackgroundOption = {
  id: string
  name: string
  previewClassName: string
}

export const PHOTOBOOTH_FILTER_OPTIONS: PhotoboothFilterOption[] = [
  {
    id: 'original',
    name: 'Màu gốc',
    previewClassName: 'bg-[linear-gradient(135deg,#E7D6BF,#C7B18C)]',
  },
  {
    id: 'bright',
    name: 'Tươi sáng',
    previewClassName: 'bg-[linear-gradient(135deg,#117A8B,#0B5E6B)]',
  },
  {
    id: 'classic',
    name: 'Cổ điển',
    previewClassName: 'bg-[linear-gradient(135deg,#E7E1D8,#C6BBAE)]',
  },
  {
    id: 'nature',
    name: 'Thiên nhiên',
    previewClassName: 'bg-[linear-gradient(135deg,#6EB4E8,#D89B41)]',
  },
  {
    id: 'bw',
    name: 'Đen trắng',
    previewClassName: 'bg-[linear-gradient(135deg,#898989,#2E2E2E)]',
  },
  {
    id: 'sunset',
    name: 'Hoàng hôn',
    previewClassName: 'bg-[linear-gradient(135deg,#FF9A6A,#FF6A88)]',
  },
  {
    id: 'cool',
    name: 'Mát lạnh',
    previewClassName: 'bg-[linear-gradient(135deg,#7FD1FF,#4F7CFF)]',
  },
]

export const PHOTOBOOTH_BACKGROUND_OPTIONS: PhotoboothBackgroundOption[] = [
  {
    id: 'scenery',
    name: 'Phong cảnh',
    previewClassName: 'bg-[linear-gradient(135deg,#7EB4E4,#E8D8C1)]',
  },
  {
    id: 'forest',
    name: 'Thiên nhiên',
    previewClassName: 'bg-[linear-gradient(135deg,#5AAAE0,#77C36B)]',
  },
  {
    id: 'lavender',
    name: 'Hoa oải hương',
    previewClassName: 'bg-[linear-gradient(135deg,#8B6CFF,#F4B2D9)]',
  },
  {
    id: 'architecture',
    name: 'Kiến trúc',
    previewClassName: 'bg-[linear-gradient(135deg,#D9C19A,#B28A57)]',
  },
  {
    id: 'city',
    name: 'Đô thị',
    previewClassName: 'bg-[linear-gradient(135deg,#8FA0C6,#D5D9E5)]',
  },
  {
    id: 'studio',
    name: 'Studio',
    previewClassName: 'bg-[linear-gradient(135deg,#DCDCDC,#F4F4F4)]',
  },
]
