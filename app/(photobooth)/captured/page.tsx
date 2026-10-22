'use client'

import { useEffect, useMemo, useState } from 'react'
import PhotoboothFrameSwipePreview from '@/src/features/photobooth/components/flow/frame/FrameSwipePreview'
import CapturedFrameCard from '@/src/features/photobooth/components/screens/captured/CapturedFrameCard'
import PrimaryButton from '@/src/features/photobooth/components/shared/controls/PrimaryButton'
import PhotoboothPageBody from '@/src/features/photobooth/components/shared/layout/PageBody'
import PhotoboothPageHeader from '@/src/features/photobooth/components/shared/layout/PageHeader'
import PhotoboothScreenShell from '@/src/features/photobooth/components/shared/layout/ScreenShell'
import { PHOTOBOOTH_SCREEN_STATE_MAP } from '@/src/features/photobooth/config/screenState'
import {
  buildPhotoboothPreviewRoundItemsFromSession,
  getPhotoboothFrameOverlaySrc,
} from '@/src/features/photobooth/constants/framePreview'
import { getAssetPath } from '@/src/features/photobooth/utils/assetPath'
import {
  getDefaultPhotoboothRuntimeSession,
  getPhotoboothRoundImageDataUrls,
  getPhotoboothRoundLayoutIds,
} from '@/src/features/photobooth/utils/runtimeSession'
import {
  getPhotoboothLayoutPreviewMode,
  type PhotoboothLayoutPreviewMode,
} from '@/src/features/photobooth/utils/layoutPreview'

const FALLBACK_CAPTURED_MODES: PhotoboothLayoutPreviewMode[] = ['grid-4']
const CAPTURED_EXPORT_WIDTH = 1080
const GRID_4_EXPORT_CARD_ASPECT = 1018 / 678

function loadExportImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

function drawCoverImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  scale = 1
) {
  const sourceRatio = image.naturalWidth / image.naturalHeight
  const targetRatio = width / height
  const sourceWidth =
    sourceRatio > targetRatio ? image.naturalHeight * targetRatio : image.naturalWidth
  const sourceHeight =
    sourceRatio > targetRatio ? image.naturalHeight : image.naturalWidth / targetRatio
  const sourceX = (image.naturalWidth - sourceWidth) / 2
  const sourceY = (image.naturalHeight - sourceHeight) / 2

  if (scale !== 1) {
    const scaledWidth = width * scale
    const scaledHeight = height * scale

    context.save()
    context.beginPath()
    context.rect(x, y, width, height)
    context.clip()
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      x - (scaledWidth - width) / 2,
      y - (scaledHeight - height) / 2,
      scaledWidth,
      scaledHeight
    )
    context.restore()
    return
  }

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height
  )
}

type ExportPhotoSlot = {
  x: number
  y: number
  width: number
  height: number
  scale?: number
  sourceIndex?: number
}

function getExportPhotoBounds(mode: PhotoboothLayoutPreviewMode) {
  if (mode === 'grid-6') {
    return { left: 0.095, right: 0.095, top: 0.092, bottom: 0.118 }
  }

  return { left: 0.09, right: 0.09, top: 0.08, bottom: 0.12 }
}

function getExportSlots(
  mode: PhotoboothLayoutPreviewMode,
  canvasWidth: number,
  canvasHeight: number
): ExportPhotoSlot[] {
  if (mode === 'grid-4') {
    const slotWidth = canvasWidth * (477 / 1200)
    const slotHeight = canvasWidth * (650 / 1200)
    const gapX = canvasWidth * (66 / 1200)
    const gapY = canvasWidth * (62 / 1200)
    const startX = canvasWidth * (90 / 1200)
    const startY = canvasWidth * (88 / 1200)

    return Array.from({ length: 4 }).map((_, index) => {
      const row = Math.floor(index / 2)
      const column = index % 2

      return {
        x: startX + column * (slotWidth + gapX),
        y: startY + row * (slotHeight + gapY),
        width: slotWidth,
        height: slotHeight,
        scale: 1.04,
      }
    })
  }

  if (mode === 'vertical-4') {
    const scale = canvasWidth / 1200
    const slotWidth = 477 * scale
    const slotHeight = 320 * scale
    const rowStarts = [88, 435, 783, 1130].map((value) => value * scale)
    const columnStarts = [61, 662].map((value) => value * scale)

    return Array.from({ length: 8 }).map((_, index) => {
      const row = Math.floor(index / 2)
      const column = index % 2

      return {
        x: columnStarts[column],
        y: rowStarts[row],
        width: slotWidth,
        height: slotHeight,
        sourceIndex: row,
      }
    })
  }

  if (mode === 'grid-6') {
    const scale = canvasWidth / 1200
    const slotWidth = 475 * scale
    const gapX = 66 * scale
    const startX = 92 * scale
    const startY = 88 * scale
    const rowHeights = [466 * scale, 466 * scale, 430 * scale]
    const rowStarts = [
      startY,
      startY + rowHeights[0],
      startY + rowHeights[0] + rowHeights[1],
    ]

    return Array.from({ length: 6 }).map((_, index) => {
      const row = Math.floor(index / 2)
      const column = index % 2

      return {
        x: startX + column * (slotWidth + gapX),
        y: rowStarts[row],
        width: slotWidth,
        height: rowHeights[row],
        scale: index >= 4 ? 1.08 : 1.04,
      }
    })
  }

  const bounds = getExportPhotoBounds(mode)
  const x = canvasWidth * bounds.left
  const y = canvasHeight * bounds.top
  const width = canvasWidth * (1 - bounds.left - bounds.right)
  const height = canvasHeight * (1 - bounds.top - bounds.bottom)

  const slotCount = mode === 'grid-6' ? 6 : 4
  const rows = mode === 'grid-6' ? 3 : 2
  const gapX = width * (mode === 'grid-6' ? 0.035 : 0.04)
  const gapY = height * (mode === 'grid-6' ? 0.02 : 0.035)
  const slotWidth = (width - gapX) / 2
  const slotHeight = mode === 'grid-6' ? slotWidth * (150 / 175) : slotWidth * (240 / 182)

  return Array.from({ length: slotCount }).map((_, index) => {
    const row = Math.floor(index / 2)
    const column = index % 2
    const usedHeight = rows * slotHeight + (rows - 1) * gapY
    const startY = y + Math.max((height - usedHeight) / 2, 0)

    return {
      x: x + column * (slotWidth + gapX),
      y: startY + row * (slotHeight + gapY),
      width: slotWidth,
      height: slotHeight,
    }
  })
}

export default function CapturedPage() {
  const screen = PHOTOBOOTH_SCREEN_STATE_MAP.captured

  const [capturedModes, setCapturedModes] = useState<PhotoboothLayoutPreviewMode[]>(() => {
    const fallbackSession = getDefaultPhotoboothRuntimeSession()
    return getPhotoboothRoundLayoutIds(fallbackSession).map((layoutId) =>
      getPhotoboothLayoutPreviewMode(layoutId)
    )
  })
  const [capturedRoundImageSrcs, setCapturedRoundImageSrcs] = useState<
    Array<Array<string | null>>
  >(() => {
    const fallbackSession = getDefaultPhotoboothRuntimeSession()
    return getPhotoboothRoundImageDataUrls(fallbackSession)
  })

  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      const nextRoundItems = buildPhotoboothPreviewRoundItemsFromSession()
      const nextModes = nextRoundItems.map((item) => item.previewMode)
      setCapturedModes(nextModes)
      setCapturedRoundImageSrcs(nextRoundItems.map((item) => item.imageSrcs))
      setCurrentImageIndex((prev) =>
        Math.min(prev, Math.max(nextModes.length - 1, 0))
      )
    }, 0)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [])

  const visibleCapturedModes = useMemo<PhotoboothLayoutPreviewMode[]>(() => {
    return capturedModes.length > 0 ? capturedModes : FALLBACK_CAPTURED_MODES
  }, [capturedModes])

  const canGoPrev = currentImageIndex > 0
  const canGoNext = currentImageIndex < visibleCapturedModes.length - 1

  function handlePrevImage() {
    if (!canGoPrev) return
    setCurrentImageIndex((prev) => prev - 1)
  }

  function handleNextImage() {
    if (!canGoNext) return
    setCurrentImageIndex((prev) => prev + 1)
  }

  async function handleDownloadCurrentImage() {
    const mode = visibleCapturedModes[currentImageIndex] ?? FALLBACK_CAPTURED_MODES[0]
    const photoSrcs = capturedRoundImageSrcs[currentImageIndex] ?? []
    const overlay = await loadExportImage(getAssetPath(getPhotoboothFrameOverlaySrc(mode)))
    const canvas = document.createElement('canvas')
    const scale = CAPTURED_EXPORT_WIDTH / overlay.naturalWidth
    const overlayHeight = Math.round(overlay.naturalHeight * scale)
    canvas.width = CAPTURED_EXPORT_WIDTH
    canvas.height =
      mode === 'grid-4'
        ? Math.round(CAPTURED_EXPORT_WIDTH * GRID_4_EXPORT_CARD_ASPECT)
        : overlayHeight

    const context = canvas.getContext('2d')
    if (!context) return

    context.fillStyle = '#E1DCC8'
    context.fillRect(0, 0, canvas.width, canvas.height)

    const slots = getExportSlots(mode, canvas.width, canvas.height)

    context.fillStyle = '#E7E1C9'
    slots.forEach((slot) => {
      context.fillRect(slot.x, slot.y, slot.width, slot.height)
    })

    await Promise.all(
      slots.map(async (slot, index) => {
        const photoSrc = photoSrcs[slot.sourceIndex ?? index]
        if (!photoSrc) return

        const image = await loadExportImage(photoSrc)
        drawCoverImage(
          context,
          image,
          slot.x,
          slot.y,
          slot.width,
          slot.height,
          slot.scale
        )
      })
    )

    context.drawImage(overlay, 0, 0, canvas.width, overlayHeight)

    canvas.toBlob((blob) => {
      if (!blob) return

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `photobooth-hinh-${currentImageIndex + 1}.png`
      document.body.appendChild(link)
      link.click()
      link.remove()

      window.setTimeout(() => {
        URL.revokeObjectURL(url)
      }, 1000)
    }, 'image/png')
  }

  return (
    <PhotoboothScreenShell>
      <div className="flex h-full min-h-0 flex-col">
        <PhotoboothPageHeader
          title={screen.title}
          backHref={screen.backHref}
          showBackButton={screen.showBackButton}
          showLanguageDropdown={screen.showLanguageDropdown}
          languageLabel="VI"
        />

        <PhotoboothPageBody className="flex min-h-0 flex-1 flex-col overflow-hidden px-[5%] pt-[2%] pb-[calc(16px+env(safe-area-inset-bottom))]">
          <div
            className="mx-auto grid h-full min-h-0 w-full max-w-[920px] flex-1 grid-rows-[minmax(0,1fr)_auto]"
            style={{ containerType: 'inline-size' }}
          >
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-visible">
              <div className="w-full max-w-[min(430px,92vw)] px-[clamp(6px,1.2cqw,12px)]">
                <PhotoboothFrameSwipePreview
                  modes={visibleCapturedModes}
                  currentIndex={currentImageIndex}
                  label={`Hình ${currentImageIndex + 1}`}
                  canGoPrev={canGoPrev}
                  canGoNext={canGoNext}
                  onPrev={handlePrevImage}
                  onNext={handleNextImage}
                  showNavigation={false}
                  stackRootClassName="relative mx-auto"
                  renderCard={(mode, options) => (
                    <CapturedFrameCard
                      mode={mode}
                      photoSrcs={capturedRoundImageSrcs[options.originalIndex] ?? []}
                    />
                  )}
                />

              </div>
            </div>

            <div className="z-10 mt-[clamp(8px,1.2svh,14px)] shrink-0 pb-[calc(clamp(18px,3svh,34px)+env(safe-area-inset-bottom))]">
              <div className="mb-[clamp(8px,1.4svh,14px)] flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    void handleDownloadCurrentImage()
                  }}
                  className="inline-flex h-[42px] min-w-[132px] items-center justify-center rounded-full bg-[#171717] px-6 text-[clamp(16px,4.1vw,20px)] font-bold text-white shadow-[0_8px_20px_rgba(0,0,0,0.14)] transition-all duration-200 hover:brightness-110 active:scale-[0.98] sm:text-[20px]"
                >
                  Tải hình
                </button>
              </div>

              <div className="grid grid-cols-2 gap-[clamp(12px,2cqw,16px)]">
                <PrimaryButton
                  href={screen.secondaryActionHref}
                  variant="secondary"
                  fullWidth
                  className="text-[clamp(16px,4.1vw,20px)] sm:text-[20px]"
                >
                  {screen.secondaryActionLabel}
                </PrimaryButton>

                <PrimaryButton
                  href={screen.nextHref}
                  fullWidth
                  className="text-[clamp(16px,4.1vw,20px)] sm:text-[20px]"
                >
                  {screen.primaryActionLabel}
                </PrimaryButton>
              </div>
            </div>
          </div>
        </PhotoboothPageBody>
      </div>
    </PhotoboothScreenShell>
  )
}
