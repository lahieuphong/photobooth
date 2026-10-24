import BrandPage from '@/src/features/photobooth/components/shared/brand/BrandPage'
import BrandMark from '@/src/features/photobooth/components/shared/layout/BrandMark'
import SiteNav from '@/src/features/photobooth/components/shared/layout/SiteNav'
import { SITE_CONTAINER } from '@/src/features/photobooth/components/shared/layout/siteLayout'
import WelcomeHero from './WelcomeHero'
import { AboutSection, ExperienceShowcase, FrameShowcase } from './WelcomeSections'

/** The cover is a scrolling landing page, unlike the single-screen capture flow. */
export default function WelcomeScreen() {
  return (
    <BrandPage>
      <SiteNav page="welcome" />
      <main>
        <WelcomeHero />
        <ExperienceShowcase />
        <FrameShowcase />
        <AboutSection />
      </main>
      <footer className="border-t border-line/70 bg-paper pt-8 pb-[max(28px,env(safe-area-inset-bottom))]">
        <div className={`${SITE_CONTAINER} flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left`}>
          <BrandMark />
          <p className="text-[13px] text-muted">Mỗi khung hình là một câu chuyện · Ảnh của bạn chỉ nằm trên máy của bạn.</p>
        </div>
      </footer>
    </BrandPage>
  )
}
