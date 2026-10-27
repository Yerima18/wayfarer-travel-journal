import { useEffect, useRef, useState } from 'react'

const DEFAULT_DURATION_MS = 900

/** Eases a number from its last value to `target`; jumps straight there when the visitor prefers reduced motion. */
export function useCountUp(target: number, durationMs = DEFAULT_DURATION_MS): number {
  const [value, setValue] = useState(0)
  const currentRef = useRef(0)

  useEffect(() => {
    const from = currentRef.current
    if (from === target) return
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const duration = prefersReducedMotion ? 0 : durationMs
    const startedAt = performance.now()
    let frame = 0

    const tick = (now: number) => {
      const progress = duration === 0 ? 1 : Math.min(1, (now - startedAt) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      const next = progress === 1 ? target : from + (target - from) * eased
      currentRef.current = next
      setValue(next)
      if (progress < 1) frame = window.requestAnimationFrame(tick)
    }

    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [target, durationMs])

  return value
}
