import React from 'react'
import PhotoboothBackground, {
  type PhotoboothBackgroundVariant,
} from './Background'

type PhotoboothScreenShellProps = {
  children?: React.ReactNode
  backgroundVariant?: PhotoboothBackgroundVariant
}

export default function PhotoboothScreenShell({
  children,
  backgroundVariant = 'plain',
}: PhotoboothScreenShellProps) {
  return (
    <main className="photobooth-screen-shell fixed inset-0 isolate w-full max-w-full overflow-hidden bg-white">
      <section className="absolute inset-0 overflow-hidden bg-white">
        <div className="h-full w-full">
          <PhotoboothBackground variant={backgroundVariant}>
            {children}
          </PhotoboothBackground>
        </div>
      </section>
    </main>
  )
}
