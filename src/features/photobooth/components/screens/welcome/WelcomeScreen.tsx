import BrandMark from '@/src/features/photobooth/components/shared/layout/BrandMark'
import { bubbleFont, handFont } from './fonts'
import WelcomeHero from './WelcomeHero'
import WelcomeNav from './WelcomeNav'
import { AboutSection, ExperienceShowcase, FrameShowcase } from './WelcomeSections'
import { WELCOME_CONTAINER } from './welcomeLayout'

/**
 * The cover is a scrolling landing page, unlike the single-screen capture flow.
 * It scrolls inside this fixed layer because phones lock html/body scrolling
 * (globals.css) to keep the camera screens from bouncing.
 */
export default function WelcomeScreen() {
  return (
    <div
      className={`${bubbleFont.variable} ${handFont.variable} fixed inset-0 overflow-x-hidden overflow-y-auto overscroll-contain bg-paper text-ink`}
    >
      <WelcomeNav />
      <main>
        <WelcomeHero />
        <ExperienceShowcase />
        <FrameShowcase />
        <AboutSection />
      </main>
      <footer className="border-t border-line/70 bg-paper pt-8 pb-[max(28px,env(safe-area-inset-bottom))]">
        <div className={`${WELCOME_CONTAINER} flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left`}>
          <BrandMark />
          <p className="text-[13px] text-muted">Mỗi khung hình là một câu chuyện · Ảnh của bạn chỉ nằm trên máy của bạn.</p>
        </div>
      </footer>
    </div>
  )
}
