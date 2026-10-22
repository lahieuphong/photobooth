import PhotoboothScreenShell from '@/src/features/photobooth/components/shared/layout/ScreenShell'
import HeaderControls from '@/src/features/photobooth/components/shared/layout/HeaderControls'
import Image from 'next/image'
import Link from 'next/link'
import { PHOTOBOOTH_SCREEN_STATE_MAP } from '@/src/features/photobooth/config/screenState'
import { getAssetPath } from '@/src/features/photobooth/utils/assetPath'

export default function WelcomeMainScreen() {
  const screen = PHOTOBOOTH_SCREEN_STATE_MAP.welcome
  const welcomeImagePreloads = [
    '/images/logos/photobooth-mark.svg',
    '/images/layouts/preview-grid-2x2.svg',
    '/images/layouts/preview-stack-4.svg',
    '/images/layouts/preview-grid-2x3.svg',
  ]

  return (
    <>
      {welcomeImagePreloads.map((src) => (
        <link
          key={src}
          rel="preload"
          as="image"
          href={getAssetPath(src)}
          fetchPriority="high"
        />
      ))}

      <PhotoboothScreenShell backgroundVariant="soft">
        <div className="welcome-main-screen relative flex h-[100svh] max-h-full min-h-0 flex-col">
          <div
            className="welcome-main-header w-full shrink-0 px-[3.704%] pt-[calc(env(safe-area-inset-top)+clamp(8px,1.8vh,24px))]"
            style={{ containerType: 'inline-size' }}
          >
            <HeaderControls
              showBackButton={screen.showBackButton}
              showLanguageDropdown={screen.showLanguageDropdown}
              languageLabel="VI"
            />
          </div>

          <div className="welcome-main-content relative z-20 flex min-h-0 flex-1 flex-col items-center px-[8%] pb-[max(env(safe-area-inset-bottom),clamp(8px,2vh,20px))] pt-[clamp(8px,2.1vh,24px)] text-center">
            <div className="welcome-main-logo w-[clamp(52px,14vw,76px)]">
              <Image
                src={getAssetPath('/images/logos/photobooth-mark.svg')}
                alt=""
                aria-hidden="true"
                width={76}
                height={76}
                priority
                className="h-auto w-full drop-shadow-[0_6px_14px_rgba(255,90,42,0.24)]"
                style={{ width: '100%', height: 'auto' }}
              />
            </div>

            <h1 className="welcome-main-title mt-[clamp(10px,2.2vh,24px)] font-serif text-[clamp(34px,10.4vw,70px)] font-medium uppercase leading-none tracking-[0.015em] text-[#1F2024]">
              Photobooth
            </h1>

            <div className="welcome-main-cta-wrap mt-[clamp(12px,3vh,28px)] flex w-full flex-1 items-center justify-center">
              <Link
                href={screen.nextHref ?? '/packages'}
                scroll={false}
                className="welcome-main-cta inline-flex h-[clamp(116px,31vw,260px)] w-[clamp(116px,31vw,260px)] flex-col items-center justify-center rounded-full bg-[#FF5A2A] pt-[clamp(2px,0.6vw,8px)] text-white shadow-[0_8px_16px_rgba(255,90,42,0.28)] transition-all duration-200 hover:brightness-95 active:scale-[0.98]"
              >
                <Image
                  src={getAssetPath('/images/illustrations/camera.svg')}
                  alt=""
                  width={44}
                  height={44}
                  aria-hidden="true"
                  priority
                  className="welcome-main-cta-icon h-[clamp(22px,6vw,40px)] w-[clamp(22px,6vw,40px)]"
                />
                <span className="welcome-main-cta-label mt-[clamp(8px,2vw,18px)] text-[clamp(20px,4.1vw,42px)] font-medium leading-none !text-white">
                  {screen.primaryActionLabel}
                </span>
              </Link>
            </div>

            <div className="welcome-main-stack pointer-events-none mt-[clamp(10px,1.8vh,24px)] w-[92%] max-w-[900px] shrink-0">
              <div className="relative mx-auto aspect-[16/6.8] w-full">
                <div className="absolute bottom-[0] left-[2%] z-10 w-[50%]">
                  <Image
                    src={getAssetPath('/images/layouts/preview-grid-2x2.svg')}
                    alt=""
                    width={344}
                    height={418}
                    priority
                    sizes="(max-width: 768px) 46vw, 420px"
                    className="h-auto w-full drop-shadow-[0_12px_20px_rgba(0,0,0,0.22)]"
                  />
                </div>

                <div className="absolute bottom-[0] left-[32%] z-20 w-[50%]">
                  <Image
                    src={getAssetPath('/images/layouts/preview-stack-4.svg')}
                    alt=""
                    width={320}
                    height={403}
                    priority
                    sizes="(max-width: 768px) 46vw, 420px"
                    className="h-auto w-full drop-shadow-[0_12px_20px_rgba(0,0,0,0.22)]"
                  />
                </div>

                <div className="absolute bottom-[0] left-[52%] z-30 w-[50%]">
                  <Image
                    src={getAssetPath('/images/layouts/preview-grid-2x3.svg')}
                    alt=""
                    width={360}
                    height={439}
                    priority
                    sizes="(max-width: 768px) 46vw, 420px"
                    className="h-auto w-full drop-shadow-[0_12px_20px_rgba(0,0,0,0.2)]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </PhotoboothScreenShell>
    </>
  )
}
