/** Full-height wash; flow decorations keep their geometry through session hydration. */
export default function PastelBackdrop({ className = '', ambient = false, stableViewport = false }: { className?: string; ambient?: boolean; stableViewport?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-linear-to-b from-petal via-blush to-[#fbdfe6] ${className}`}
    >
      <div className={`absolute inset-x-0 top-0 ${stableViewport ? 'h-svh' : 'h-full'}`}>
        <div className={`${ambient ? 'motion-depth' : ''} absolute -top-[15%] -left-[20%] size-[60vmax] rounded-full bg-[radial-gradient(closest-side,rgb(255_255_255/0.8),transparent)]`} />
        <div className="absolute top-[8%] -right-[18%] size-[55vmax] rounded-full bg-[radial-gradient(closest-side,rgb(245_191_204/0.55),transparent)]" />
        <div className="absolute -bottom-[25%] left-[20%] size-[45vmax] rounded-full bg-[radial-gradient(closest-side,rgb(255_243_209/0.85),transparent)]" />
        <span className="absolute top-[18%] left-[46%] size-2 rounded-full bg-accent/25" />
        <span className="absolute top-[70%] left-[6%] size-3 rounded-full bg-sunny/50" />
        <span className="absolute top-[12%] right-[6%] size-2.5 rounded-full bg-sunny/60" />
      </div>
    </div>
  )
}
