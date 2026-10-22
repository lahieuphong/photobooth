import { redirect } from 'next/navigation'
import { PHOTOBOOTH_ROUTES } from '@/src/features/photobooth/config/routes'

export default function HomePage() {
  redirect(PHOTOBOOTH_ROUTES.WELCOME)
}
