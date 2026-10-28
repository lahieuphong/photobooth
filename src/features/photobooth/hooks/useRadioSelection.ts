'use client'

import { useRef, type KeyboardEvent } from 'react'

const ARROW_STEPS: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }
const HORIZONTAL_ARROW_STEPS: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 }

type RadioSelectionOptions = {
  /** A horizontal tab list leaves Up/Down to page scrolling. */
  orientation?: 'horizontal' | 'both'
}

/**
 * Shared radio (and tab list) keyboard behavior: arrows move with wrapping,
 * Home/End jump to the ends. Each option keeps its own selected state and tabIndex.
 */
export function useRadioSelection<T>(
  options: readonly T[],
  onSelect: (option: T) => void,
  { orientation = 'both' }: RadioSelectionOptions = {}
) {
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const steps = orientation === 'horizontal' ? HORIZONTAL_ARROW_STEPS : ARROW_STEPS

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const count = options.length
    if (count === 0) return
    let next: number
    if (event.key in steps) next = (index + steps[event.key] + count) % count
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = count - 1
    else return

    event.preventDefault()
    onSelect(options[next])
    optionRefs.current[next]?.focus()
  }

  return { optionRefs, handleKeyDown }
}
