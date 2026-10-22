import Image from 'next/image'

/** A captured shot with the session look; explains instead of breaking when the blob is gone. */
export default function ShotImage({ url, filter, fit, sizes }: { url: string | null; filter: string; fit: 'cover' | 'contain'; sizes: string }) {
  if (!url) {
    return (
      <span className="absolute inset-0 flex items-center justify-center p-2 text-center text-[12px] text-muted">
        Ảnh không còn trên máy này
      </span>
    )
  }

  return (
    <Image
      src={url}
      alt=""
      fill
      unoptimized
      sizes={sizes}
      draggable={false}
      className={fit === 'cover' ? 'object-cover' : 'object-contain'}
      style={{ filter }}
    />
  )
}
