'use client'

import { ChevronLeft, ChevronRight, RotateCcw, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import ShotImage from './ShotImage'

type ShotLightboxProps = {
  index: number
  total: number
  url: string | null
  filter: string
  onNavigate: (index: number) => void
  onRetake: () => void
  onClose: () => void
}

const pad = (value: number) => String(value).padStart(2, '0')

/** Native modal dialog: focus trap, inert background, Escape and focus restore come from the browser. */
export default function ShotLightbox({ index, total, url, filter, onNavigate, onRetake, onClose }: ShotLightboxProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => {
      if (dialog?.open) dialog.close()
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowRight') onNavigate((index + 1) % total)
      if (event.key === 'ArrowLeft') onNavigate((index - 1 + total) % total)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [index, total, onNavigate])

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-label={`Ảnh ${index + 1} trên ${total}`}
      className="m-0 h-full max-h-none w-full max-w-none flex-col bg-ink/95 p-[max(16px,env(safe-area-inset-top))_16px_max(16px,env(safe-area-inset-bottom))] text-white backdrop:bg-transparent open:flex"
    >
      <div className="flex shrink-0 items-center justify-between">
        <p className="font-display text-[22px] tabular-nums">
          {pad(index + 1)} <span className="text-white/50">/ {pad(total)}</span>
        </p>
        <button
          type="button"
          autoFocus
          onClick={() => dialogRef.current?.close()}
          aria-label="Đóng"
          className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
        >
          <X aria-hidden="true" size={22} />
        </button>
      </div>

      <div className="relative my-4 min-h-0 flex-1">
        <ShotImage url={url} filter={filter} fit="contain" sizes="100vw" />
      </div>

      <div className="flex shrink-0 items-center justify-center gap-3">
        <button
          type="button"
          aria-label="Ảnh trước"
          onClick={() => onNavigate((index - 1 + total) % total)}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-white/25 hover:bg-white/10"
        >
          <ChevronLeft aria-hidden="true" size={20} />
        </button>
        <button
          type="button"
          onClick={onRetake}
          className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-[15px] font-semibold text-ink"
        >
          <RotateCcw aria-hidden="true" size={16} />
          Chụp lại ảnh này
        </button>
        <button
          type="button"
          aria-label="Ảnh tiếp theo"
          onClick={() => onNavigate((index + 1) % total)}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-white/25 hover:bg-white/10"
        >
          <ChevronRight aria-hidden="true" size={20} />
        </button>
      </div>
    </dialog>
  )
}
