type MarketingPhotoProps = {
  src: string
  sourceSet: string
  sizes: string
  loading?: 'eager' | 'lazy'
  className?: string
}

/** Static, decorative samples need no image state or hydration callback. */
export default function MarketingPhoto({ src, sourceSet, sizes, loading = 'lazy', className = '' }: MarketingPhotoProps) {
  return (
    <picture className="absolute inset-0 block bg-[linear-gradient(130deg,#fae5e9,#f1e3e2_46%,#f8e4cb)]">
      <source srcSet={sourceSet} sizes={sizes} />
      {/* Native responsive sources work without an image server on GitHub Pages. */}
      <img
        src={src}
        alt=""
        sizes={sizes}
        loading={loading}
        decoding="async"
        draggable={false}
        className={`absolute inset-0 h-full w-full object-cover ${className}`}
      />
    </picture>
  )
}
