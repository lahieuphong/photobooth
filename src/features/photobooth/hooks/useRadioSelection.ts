'use client'

import { useRef, type KeyboardEvent } from 'react'

const ARROW_STEPS: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }

/** Shared radio keyboard behavior; each option keeps its own selected state and tabIndex. */
export function useRadioSelection<T>(options: readonly T[], onSelect: (option: T) => void) {
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const count = options.length
    if (count === 0) return
    let next: number
    if (event.key in ARROW_STEPS) next = (index + ARROW_STEPS[event.key] + count) % count
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = count - 1
    else return

    event.preventDefault()
    onSelect(options[next])
    optionRefs.current[next]?.focus()
  }

  return { optionRefs, handleKeyDown }
}
