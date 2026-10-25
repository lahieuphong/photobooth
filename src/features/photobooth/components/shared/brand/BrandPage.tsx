'use client'

import { useRef, type ReactNode } from 'react'
import { useSweetMotion } from '@/src/features/photobooth/hooks/useSweetMotion'
import { bubbleFont, handFont } from './fonts'

/**
 * Scrolling page layer for the playful screens (Welcome, Experience), unlike the
 * single-screen camera flow. It scrolls inside this fixed layer because phones
 * lock html/body scrolling (globals.css) to keep the camera screens from bouncing.
 */
export default function BrandPage({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  useSweetMotion(scrollRef)
  return (
    <div
      ref={scrollRef}
      data-motion-root=""
      className={`${bubbleFont.variable} ${handFont.variable} fixed inset-0 overflow-x-hidden overflow-y-auto overscroll-contain bg-paper text-ink`}
    >
      {children}
    </div>
  )
}
