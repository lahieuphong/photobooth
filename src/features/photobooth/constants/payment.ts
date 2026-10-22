export type PhotoboothBankQrConfig = {
  bankCode: string
  accountNumber: string
  accountName: string
  template: 'qr_only' | 'compact2' | 'compact' | 'print'
}

export const PHOTOBOOTH_PAYMENT_QR_EXPIRED_IN_SECONDS = 120
export const PHOTOBOOTH_PAYMENT_QR_TEXT = 'PHOTOBOOTH-ORDER-001'

export const PHOTOBOOTH_PAYMENT_BANK_ACCOUNT: PhotoboothBankQrConfig = {
  bankCode: 'MB',
  accountNumber: '0326526898',
  accountName: 'La Hieu Phong',
  template: 'qr_only',
}