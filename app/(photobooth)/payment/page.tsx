'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import PhotoboothScreenShell from '@/src/features/photobooth/components/shared/layout/ScreenShell'
import PhotoboothPageHeader from '@/src/features/photobooth/components/shared/layout/PageHeader'
import PhotoboothPageBody from '@/src/features/photobooth/components/shared/layout/PageBody'
import PrimaryButton from '@/src/features/photobooth/components/shared/controls/PrimaryButton'
import { PHOTOBOOTH_PACKAGE_OPTIONS } from '@/src/features/photobooth/constants/packages'
import {
  PHOTOBOOTH_PAYMENT_BANK_ACCOUNT,
  PHOTOBOOTH_PAYMENT_QR_EXPIRED_IN_SECONDS,
  PHOTOBOOTH_PAYMENT_QR_TEXT,
} from '@/src/features/photobooth/constants/payment'
import { PHOTOBOOTH_SCREEN_STATE_MAP } from '@/src/features/photobooth/config/screenState'
import { getAssetPath } from '@/src/features/photobooth/utils/assetPath'
import { buildPaymentQrSrc } from '@/src/features/photobooth/utils/paymentQr'
import { readPhotoboothRuntimeSession } from '@/src/features/photobooth/utils/runtimeSession'

const PAYMENT_QR_FRAME_SRC = '/images/payment/qr-frame.png'

export default function PaymentPage() {
  const router = useRouter()
  const screen = PHOTOBOOTH_SCREEN_STATE_MAP.payment
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null)
  const [isPaymentSuccess, setIsPaymentSuccess] = useState(false)
  const [qrRequestVersion, setQrRequestVersion] = useState(0)
  const [loadedQrSrc, setLoadedQrSrc] = useState<string | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState(
    PHOTOBOOTH_PAYMENT_QR_EXPIRED_IN_SECONDS
  )

  useEffect(() => {
    const runtimeSession = readPhotoboothRuntimeSession()
    setSelectedPackageId(runtimeSession.selectedPackageId ?? null)
  }, [])

  useEffect(() => {
    if (remainingSeconds <= 0 || isPaymentSuccess) {
      return
    }

    const intervalId = window.setInterval(() => {
      setRemainingSeconds((prev) => Math.max(prev - 1, 0))
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [isPaymentSuccess, remainingSeconds])

  useEffect(() => {
    if (!isPaymentSuccess) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      router.push(screen.nextHref ?? '/layout', { scroll: false })
    }, 5000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [isPaymentSuccess, router, screen.nextHref])

  const selectedAmount = useMemo(() => {
    return (
      PHOTOBOOTH_PACKAGE_OPTIONS.find((item) => item.id === selectedPackageId)?.price ??
      PHOTOBOOTH_PACKAGE_OPTIONS[0]?.price ??
      0
    )
  }, [selectedPackageId])

  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60
  const isQrExpired = remainingSeconds === 0
  const timeText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(
    2,
    '0'
  )}`
  const priceTagText = `${new Intl.NumberFormat('vi-VN').format(selectedAmount)} vnd`
  const paymentQrSrc = useMemo(() => {
    return buildPaymentQrSrc({
      bankAccount: PHOTOBOOTH_PAYMENT_BANK_ACCOUNT,
      amount: selectedAmount,
      addInfo: PHOTOBOOTH_PAYMENT_QR_TEXT,
      cacheBust: qrRequestVersion,
    })
  }, [qrRequestVersion, selectedAmount])
  const isQrLoading = loadedQrSrc !== paymentQrSrc

  function handleMockPaymentComplete() {
    if (isPaymentSuccess) return
    setIsPaymentSuccess(true)
  }

  function handleRefreshQrCode() {
    setRemainingSeconds(PHOTOBOOTH_PAYMENT_QR_EXPIRED_IN_SECONDS)
    setQrRequestVersion((prev) => prev + 1)
  }

  return (
    <PhotoboothScreenShell backgroundVariant="soft">
      <div className="relative flex h-[100svh] max-h-full min-h-0 flex-col">
        <div
          className={[
            'pointer-events-none absolute left-1/2 top-[clamp(56px,7.5vh,84px)] z-30 h-[66px] w-[min(78vw,320px)] -translate-x-1/2 rounded-[12px] bg-[#DFF5E8]/90 px-3 text-center transition-opacity duration-200',
            isPaymentSuccess ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
        >
          <div className="flex translate-y-[2px] flex-col items-center">
            <div className="mx-auto mb-0 grid h-10 w-10 place-items-center">
              <Image
                src={getAssetPath('/images/payment/checked.svg')}
                alt=""
                width={30}
                height={30}
                className="h-[30px] w-[30px]"
                aria-hidden="true"
              />
            </div>
            <p className="text-[13px] font-medium text-[#009245]">Thanh toán thành công</p>
          </div>
        </div>

        <PhotoboothPageHeader
          title={screen.title}
          backHref={screen.backHref}
          showBackButton={screen.showBackButton}
          showLanguageDropdown={screen.showLanguageDropdown}
          languageLabel="VI"
          titleClassName={`transition-opacity duration-200 ${
            isPaymentSuccess ? 'opacity-0' : 'opacity-100'
          }`}
        />

        <PhotoboothPageBody className="flex flex-1 flex-col items-center overflow-x-hidden pt-0 pb-0">
          <div className="flex w-full flex-1 flex-col items-center justify-center">
            <div className="relative mt-0 w-full max-w-[340px] pt-[clamp(1px,0.2vh,3px)]">
              <div className="relative mx-auto w-[min(78vw,320px)] rounded-[24px] border border-[#F2B39B] bg-white/90 px-[8px] pt-[8px] pb-[26px]">
                <div className="p-0">
                  <div className="relative aspect-square w-full overflow-hidden rounded-[10px] bg-white">
                    <div className="absolute left-[14.2%] right-[14.2%] top-[18.8%] bottom-[14.2%] z-[1] overflow-hidden bg-white">
                      <Image
                        src={paymentQrSrc}
                        alt="QR thanh toán MB"
                        fill
                        unoptimized
                        sizes="(max-width: 768px) 210px, 260px"
                        className="object-cover"
                        onLoad={() => setLoadedQrSrc(paymentQrSrc)}
                        onError={() => setLoadedQrSrc(paymentQrSrc)}
                      />

                      {isQrLoading ? (
                        <div className="absolute inset-0 z-[9] flex flex-col items-center justify-center bg-white/92">
                          <div className="relative h-[46px] w-[46px]">
                            <div className="absolute inset-0 rounded-full border-[6px] border-[#F3CBAF]/70" />
                            <div
                              aria-hidden="true"
                              className="absolute inset-0 animate-spin rounded-full border-[6px] border-transparent border-r-[#FF5A2A] border-t-[#FF7A5F]"
                            />
                          </div>
                          <span className="mt-1 text-[12px] font-medium text-[#FF5A2A]">
                            Đang tạo mã QR...
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <Image
                      src={getAssetPath(PAYMENT_QR_FRAME_SRC)}
                      alt="Khung mã QR"
                      fill
                      sizes="(max-width: 768px) 240px, 320px"
                      className="pointer-events-none absolute inset-0 z-[2] object-contain"
                    />

                    {isQrExpired ? (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-white/80 px-4 text-center">
                        <p className="text-[20px] font-medium leading-none text-[#1E1E1E]">
                          Mã QR hết hạn
                        </p>
                        <button
                          type="button"
                          onClick={handleRefreshQrCode}
                          className="inline-flex h-[42px] min-w-[160px] items-center justify-center rounded-full bg-[#FF5A2A] px-6 text-[13px] font-semibold text-white transition-all duration-200 hover:brightness-95 active:scale-[0.98]"
                        >
                          Lấy mã QR mới
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="absolute left-1/2 top-full -translate-x-1/2 -translate-y-[65%] whitespace-nowrap rounded-[8px] bg-[#1F2024] px-[26px] py-[11px] text-[14px] font-medium lowercase leading-none tracking-[0.02em] text-white">
                  {priceTagText}
                </div>
              </div>
            </div>

            <div className="mt-[clamp(12px,2.2vh,18px)] text-center text-[13px] font-medium text-[#2E2A26]">
              Quét mã để thanh toán
            </div>

            <div
              className={[
                'mt-1 text-center text-[18px] font-medium',
                isQrExpired ? 'text-[#FF5A2A]' : 'text-[#2E2A26]',
              ].join(' ')}
            >
              {timeText}
            </div>
          </div>

          <div className="flex w-full justify-center pt-4 pb-[calc(clamp(18px,3svh,34px)+env(safe-area-inset-bottom))]">
            <PrimaryButton
              onClick={handleMockPaymentComplete}
              disabled={isPaymentSuccess}
              className="whitespace-nowrap !text-[12px]"
              fullWidth={false}
            >
              {screen.primaryActionLabel}
            </PrimaryButton>
          </div>
        </PhotoboothPageBody>
      </div>
    </PhotoboothScreenShell>
  )
}
