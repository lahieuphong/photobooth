/** Page gutter matching ScreenShell, plus safe areas for notched phones held sideways. */
export const WELCOME_CONTAINER =
  'mx-auto w-full max-w-310 pl-[max(16px,env(safe-area-inset-left))] pr-[max(16px,env(safe-area-inset-right))] ' +
  'sm:pl-[max(32px,env(safe-area-inset-left))] sm:pr-[max(32px,env(safe-area-inset-right))]'

/** In-page sections, in scroll order; the nav links and scroll spy read from this list. */
export const WELCOME_SECTIONS = [
  { id: 'trang-chu', label: 'Trang chủ' },
  { id: 'trai-nghiem', label: 'Trải nghiệm' },
  { id: 'mau-khung', label: 'Mẫu khung hình' },
  { id: 've-chung-minh', label: 'Về chúng mình' },
] as const

export type WelcomeSectionId = (typeof WELCOME_SECTIONS)[number]['id']
