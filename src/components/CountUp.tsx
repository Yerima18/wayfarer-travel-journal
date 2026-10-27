'use client'

import { useCountUp } from '@/lib/use-count-up'

type CountUpProps = {
  value: number
  /** Minimum digits, e.g. 2 renders 7 as "07". */
  pad?: number
}

/** A whole number that counts up to its value. */
export default function CountUp({ value, pad = 1 }: CountUpProps) {
  const shown = Math.round(useCountUp(value))
  return <span>{String(shown).padStart(pad, '0')}</span>
}
