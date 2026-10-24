'use client'

import { ArrowRight, Menu, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import Button from '@/src/features/photobooth/components/shared/controls/Button'
import BrandMark from '@/src/features/photobooth/components/shared/layout/BrandMark'
import { PHOTOBOOTH_ROUTES } from '@/src/features/photobooth/config/routes'
import SectionLink from './SectionLink'
import { SITE_CONTAINER, WELCOME_SECTIONS, type WelcomeSectionId } from './siteLayout'

type SiteNavProps = {
  /**
   * On Welcome the links scroll to its sections. On Experience they lead back to
   * those sections, except "Trải nghiệm", which is the Experience page itself.
   */
  page: 'welcome' | 'experience'
}

const MENU_ID = 'site-menu'

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

function isWelcomeSection(value: string): value is WelcomeSectionId {
  return WELCOME_SECTIONS.some((section) => section.id === value)
}

function getHref(id: WelcomeSectionId) {
  if (id === 'trang-chu') return PHOTOBOOTH_ROUTES.WELCOME
  if (id === 'trai-nghiem') return PHOTOBOOTH_ROUTES.EXPERIENCE
  return `${PHOTOBOOTH_ROUTES.WELCOME}#${id}`
}

export default function SiteNav({ page }: SiteNavProps) {
  const isWelcome = page === 'welcome'
  const headerRef = useRef<HTMLElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const [activeId, setActiveId] = useState<WelcomeSectionId>(isWelcome ? WELCOME_SECTIONS[0].id : 'trai-nghiem')
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  useEffect(() => {
    if (!isWelcome) return

    // Arriving from another page via /welcome/#section: the sections scroll inside
    // BrandPage, so jump there explicitly once they exist.
    const hash = window.location.hash.slice(1)
    if (isWelcomeSection(hash)) document.getElementById(hash)?.scrollIntoView({ block: 'start' })

    // Scroll spy: the active section is the one crossing the middle of the viewport.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && isWelcomeSection(entry.target.id)) setActiveId(entry.target.id)
        }
      },
      { rootMargin: '-45% 0px -50% 0px' }
    )
    for (const { id } of WELCOME_SECTIONS) {
      const section = document.getElementById(id)
      if (section) observer.observe(section)
    }
    return () => observer.disconnect()
  }, [isWelcome])

  useEffect(() => {
    if (!isMenuOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setIsMenuOpen(false)
      toggleRef.current?.focus()
    }
    function handlePointerDown(event: PointerEvent) {
      if (!headerRef.current?.contains(event.target as Node)) setIsMenuOpen(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isMenuOpen])

  function renderLink(id: WelcomeSectionId, label: string, className: string, onNavigate?: () => void) {
    const isActive = id === activeId
    if (isWelcome) {
      return (
        <SectionLink to={id} onNavigate={onNavigate} aria-current={isActive ? 'true' : undefined} className={className}>
          {label}
        </SectionLink>
      )
    }
    return (
      <Link href={getHref(id)} onClick={onNavigate} aria-current={isActive ? 'page' : undefined} className={className}>
        {label}
      </Link>
    )
  }

  return (
    <header ref={headerRef} className="sticky top-0 z-40 bg-petal/80 backdrop-blur-md">
      <div
        className={`${SITE_CONTAINER} flex h-16 items-center justify-between gap-4 sm:h-20 lg:grid lg:h-24 lg:grid-cols-[1fr_auto_1fr] short:h-14`}
      >
        <div className="justify-self-start">
          <BrandMark size="nav" />
        </div>

        <nav aria-label="Điều hướng trang" className="hidden lg:block">
          <ul className="flex items-center gap-1 rounded-full bg-white/70 p-1.5 shadow-[0_8px_24px_-14px_rgba(176,58,85,0.5)] ring-1 ring-blush-deep/70">
            {WELCOME_SECTIONS.map(({ id, label }) => (
              <li key={id}>
                {renderLink(
                  id,
                  label,
                  `inline-flex h-10 items-center rounded-full px-4 text-[14px] font-semibold transition-colors duration-200 ${FOCUS_RING} ${
                    id === activeId ? 'bg-blush text-accent-deep' : 'text-ink-soft hover:bg-white hover:text-cocoa'
                  }`
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2 justify-self-end">
          {/* Experience is the start of the flow already, so it needs no "Bắt đầu". */}
          {isWelcome ? (
            <div className="hidden sm:block">
              <Button href={PHOTOBOOTH_ROUTES.EXPERIENCE} className="hover:-translate-y-0.5">
                Bắt đầu
                <ArrowRight aria-hidden="true" size={18} />
              </Button>
            </div>
          ) : null}
          <button
            ref={toggleRef}
            type="button"
            aria-expanded={isMenuOpen}
            aria-controls={MENU_ID}
            aria-label={isMenuOpen ? 'Đóng menu' : 'Mở menu'}
            onClick={() => setIsMenuOpen((open) => !open)}
            className={`grid size-12 place-items-center rounded-full bg-white text-cocoa shadow-[0_6px_16px_-10px_rgba(176,58,85,0.6)] ring-1 ring-blush-deep transition-colors hover:bg-blush lg:hidden short:size-11 ${FOCUS_RING}`}
          >
            {isMenuOpen ? <X aria-hidden="true" size={22} /> : <Menu aria-hidden="true" size={22} />}
          </button>
        </div>
      </div>

      {isMenuOpen ? (
        <div id={MENU_ID} className={`${SITE_CONTAINER} absolute inset-x-0 top-full lg:hidden`}>
          <nav
            aria-label="Menu"
            className="animate-rise rounded-[28px] bg-white p-3 shadow-[0_24px_48px_-20px_rgba(74,29,36,0.45)] ring-1 ring-blush-deep/70"
          >
            <ul className="flex flex-col gap-1">
              {WELCOME_SECTIONS.map(({ id, label }) => (
                <li key={id}>
                  {renderLink(
                    id,
                    label,
                    `flex h-12 items-center rounded-2xl px-4 text-[15px] font-semibold ${FOCUS_RING} ${
                      id === activeId ? 'bg-blush text-accent-deep' : 'text-cocoa hover:bg-petal'
                    }`,
                    () => setIsMenuOpen(false)
                  )}
                </li>
              ))}
            </ul>
            {isWelcome ? (
              <Button href={PHOTOBOOTH_ROUTES.EXPERIENCE} variant="candy" size="lg" className="mt-3 w-full sm:hidden">
                Bắt đầu
                <ArrowRight aria-hidden="true" size={18} />
              </Button>
            ) : null}
          </nav>
        </div>
      ) : null}
    </header>
  )
}
