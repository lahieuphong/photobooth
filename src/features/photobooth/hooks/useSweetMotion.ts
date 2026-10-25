'use client'

import { useEffect, type RefObject } from 'react'

const AMBIENT = '.animate-float, .animate-nudge, .motion-depth'
const TARGETS = `[data-reveal], ${AMBIENT}`

/** One observer and one scroll coordinator per real scroll root; no React state or camera dependencies. */
export function useSweetMotion(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    const desktop = matchMedia('(min-width: 1024px) and (pointer: fine)')
    const seen = new Set<Element>()
    const parallax = new Set<HTMLElement>()
    let frame = 0

    function reveal(element: Element) {
      element.setAttribute('data-reveal-state', 'shown')
      if (!element.matches(AMBIENT)) observer?.unobserve(element)
    }

    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const element = entry.target
        if (entry.isIntersecting && element.getAttribute('data-reveal-state') === 'pending') reveal(element)
        if (element.matches(AMBIENT)) element.setAttribute('data-motion-active', String(entry.isIntersecting))
      }
    }, { root, threshold: 0 })

    function scan(parent: Element) {
      const elements = [parent, ...parent.querySelectorAll(TARGETS)]
      for (const element of elements) {
        if (!element.matches(TARGETS) || seen.has(element)) continue
        seen.add(element)
        // Only arm below-the-fold content after hydration, and only if observation works.
        // Initial viewport, unsupported browsers and server HTML always remain visible.
        if (element.hasAttribute('data-reveal')) {
          if (observer && !reduced.matches && element.getBoundingClientRect().top >= root!.getBoundingClientRect().bottom) {
            element.setAttribute('data-reveal-state', 'pending')
          } else {
            element.setAttribute('data-reveal-state', 'shown')
          }
        }
        observer?.observe(element)
      }
      for (const element of [parent, ...parent.querySelectorAll('[data-parallax]')]) {
        if (element instanceof HTMLElement && element.hasAttribute('data-parallax')) parallax.add(element)
      }
    }

    function updateParallax() {
      frame = 0
      const enabled = !document.hidden && !reduced.matches && desktop.matches
      for (const element of parallax) {
        const depth = Number(element.dataset.parallax) || 0
        element.style.setProperty('--parallax-y', `${enabled ? Math.min(12, Math.max(-12, root!.scrollTop * depth)) : 0}px`)
      }
    }

    function requestParallax() {
      if (!frame && parallax.size && desktop.matches && !reduced.matches && !document.hidden) frame = requestAnimationFrame(updateParallax)
    }

    function syncPreferences() {
      root!.dataset.motionHidden = String(document.hidden)
      if (reduced.matches) for (const element of seen) {
        if (element.getAttribute('data-reveal-state') === 'pending') reveal(element)
      }
      if (frame) cancelAnimationFrame(frame)
      updateParallax()
    }

    function focusReveal(event: FocusEvent) {
      // Keyboard focus must never land in an invisible section, even during a fast jump.
      let element = event.target instanceof Element ? event.target : null
      while (element && element !== root) {
        if (element.getAttribute('data-reveal-state') === 'pending') reveal(element)
        element = element.parentElement
      }
    }

    scan(root)
    syncPreferences()
    // Loading screens keep BrandPage mounted. Observe newly inserted decorations without remounting children.
    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.removedNodes) if (node instanceof Element) {
          for (const element of [node, ...node.querySelectorAll(TARGETS)]) {
            observer?.unobserve(element)
            seen.delete(element)
          }
          for (const element of parallax) if (node.contains(element)) parallax.delete(element)
        }
        for (const node of record.addedNodes) if (node instanceof Element) scan(node)
      }
    })
    mutations.observe(root, { childList: true, subtree: true })
    root.addEventListener('scroll', requestParallax, { passive: true })
    root.addEventListener('focusin', focusReveal)
    document.addEventListener('visibilitychange', syncPreferences)
    reduced.addEventListener('change', syncPreferences)
    desktop.addEventListener('change', syncPreferences)
    return () => {
      observer?.disconnect()
      mutations.disconnect()
      if (frame) cancelAnimationFrame(frame)
      root.removeEventListener('scroll', requestParallax)
      root.removeEventListener('focusin', focusReveal)
      document.removeEventListener('visibilitychange', syncPreferences)
      reduced.removeEventListener('change', syncPreferences)
      desktop.removeEventListener('change', syncPreferences)
      for (const element of seen) {
        element.removeAttribute('data-reveal-state')
        element.removeAttribute('data-motion-active')
      }
      for (const element of parallax) element.style.removeProperty('--parallax-y')
      delete root.dataset.motionHidden
    }
  }, [ref])
}
