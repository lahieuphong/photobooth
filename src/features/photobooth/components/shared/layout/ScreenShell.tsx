import type { ReactNode } from 'react'

type ScreenShellProps = {
  children: ReactNode
  className?: string
}

/** Full-viewport frame with safe-area padding; every screen is a single non-scrolling column. */
export default function ScreenShell({ children, className = '' }: ScreenShellProps) {
  return (
    <main className="photobooth-screen-shell fixed inset-0 w-full overflow-hidden bg-paper text-ink">
      <div
        className={[
          'mx-auto flex h-full min-h-0 w-full max-w-295 flex-col',
          'pt-[max(12px,env(safe-area-inset-top))] pb-[max(16px,env(safe-area-inset-bottom))]',
          'pl-[max(16px,env(safe-area-inset-left))] pr-[max(16px,env(safe-area-inset-right))]',
          'sm:pl-[max(32px,env(safe-area-inset-left))] sm:pr-[max(32px,env(safe-area-inset-right))]',
          className,
        ].join(' ')}
      >
        {children}
      </div>
    </main>
  )
}
