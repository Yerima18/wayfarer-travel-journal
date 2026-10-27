'use client'

import type { CSSProperties } from 'react'

import { useI18n } from '@/lib/i18n'
import { useCountUp } from '@/lib/use-count-up'

export const WORLD_COUNTRY_TOTAL = 195

/** Share of the world's countries in the journal, 0 to 100. */
export function worldPercentOf(countryCount: number): number {
  return Math.min(100, (countryCount / WORLD_COUNTRY_TOTAL) * 100)
}

const RING_SIZE = 124
const RING_STROKE = 11
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS
const GRADIENT_ID = 'world-ring-gradient'

type WorldProgressProps = {
  countryCount: number
  rankTitle: string
}

/** A ring showing how much of the world is in the journal. */
export default function WorldProgress({ countryCount, rankTitle }: WorldProgressProps) {
  const { locale, t } = useI18n()
  const percent = worldPercentOf(countryCount)
  const shownPercent = useCountUp(percent, 1200)
  const percentText = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(shownPercent)
  const remaining = Math.max(0, WORLD_COUNTRY_TOTAL - countryCount)

  return (
    <section className="panel world-progress reveal" style={{ '--i': 3 } as CSSProperties} aria-label={t('progress.aria')}>
      <div className="ring-wrap">
        <svg viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} className="ring" aria-hidden="true">
          <defs>
            {/* The arc is rotated to start at the top, so the gradient is counter-rotated to stay screen-aligned. */}
            <linearGradient id={GRADIENT_ID} gradientUnits="userSpaceOnUse" gradientTransform={`rotate(90 ${RING_SIZE / 2} ${RING_SIZE / 2})`} x1="0" y1="0" x2={RING_SIZE} y2={RING_SIZE}>
              <stop offset="0%" stopColor="#ff6b57" />
              <stop offset="55%" stopColor="#ffb627" />
              <stop offset="100%" stopColor="#7c5cff" />
            </linearGradient>
          </defs>
          <circle className="ring-track" cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} strokeWidth={RING_STROKE} fill="none" />
          <circle
            className="ring-value-arc"
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            strokeWidth={RING_STROKE}
            fill="none"
            stroke={`url(#${GRADIENT_ID})`}
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={RING_CIRCUMFERENCE * (1 - shownPercent / 100)}
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        </svg>
        <div className="ring-center"><strong>{`${percentText}%`}</strong></div>
      </div>
      <div className="progress-copy">
        <div className="panel-kicker">{t('progress.kicker')}</div>
        <h2>{t('progress.count', { n: countryCount, total: WORLD_COUNTRY_TOTAL })}</h2>
        <p>{countryCount === 0 ? t('progress.hintEmpty') : t('progress.hint', { n: remaining })}</p>
        <span className="progress-rank">{rankTitle}</span>
      </div>
    </section>
  )
}
