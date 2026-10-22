import Image from 'next/image'
import { getAssetPath } from '@/src/features/photobooth/utils/assetPath'

const CUSTOMIZE_LAYOUT_PREVIEW_IMAGES: Record<string, string> = {
  'layout-grid-4': '/images/layouts/preview-grid-2x2.svg',
  'layout-vertical-4': '/images/layouts/preview-stack-4.svg',
  'layout-grid-6': '/images/layouts/preview-grid-2x3.svg',
}

function getCustomizePreviewImage(selectedLayoutId: string) {
  return (
    CUSTOMIZE_LAYOUT_PREVIEW_IMAGES[selectedLayoutId] ??
    CUSTOMIZE_LAYOUT_PREVIEW_IMAGES['layout-grid-4']
  )
}

type CustomizeLayoutStackPreviewProps = {
  selectedLayoutId: string
  currentRound: number
}

export default function CustomizeLayoutStackPreview({
  selectedLayoutId,
  currentRound,
}: CustomizeLayoutStackPreviewProps) {
  const previewImage = getCustomizePreviewImage(selectedLayoutId)
  const stackCount = Math.max(1, Math.min(currentRound, 3))

  const layerOffsets = [0, 5, 10]
  const layerRotations = [0, 1.2, 2.4]

  return (
    <div className="relative h-[88px] w-[74px] shrink-0 overflow-visible">
      {Array.from({ length: stackCount }).map((_, renderIndex) => {
        const depth = stackCount - 1 - renderIndex
        const offset = layerOffsets[depth] ?? 0
        const rotation = layerRotations[depth] ?? 0

        return (
          <div
            key={`${selectedLayoutId}-${currentRound}-${renderIndex}`}
            className="absolute origin-bottom-left"
            style={{
              left: `${offset}px`,
              bottom: `${offset}px`,
              width: '60px',
              height: '80px',
              transform: `rotate(${rotation}deg)`,
              zIndex: renderIndex + 1,
            }}
          >
            <Image
              src={getAssetPath(previewImage)}
              alt="Bố cục đã chọn"
              fill
              sizes="60px"
              className="object-contain drop-shadow-[0_3px_8px_rgba(0,0,0,0.12)]"
            />
          </div>
        )
      })}

      <div className="absolute right-0 top-0 z-[40] flex h-6 w-6 items-center justify-center rounded-full bg-[#171717] text-[11px] font-semibold text-white shadow-[0_4px_10px_rgba(0,0,0,0.18)]">
        {currentRound}
      </div>
    </div>
  )
}
