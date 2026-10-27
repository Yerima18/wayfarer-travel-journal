import { countries } from './countries'
import { flagCode } from './flags'
import { isSchengen } from './schengen'
import passportCodes from './visaPassports.json'

export type VisaStatus = 'self' | 'free' | 'arrival' | 'evisa' | 'required' | 'banned' | 'unknown'
export type VisaInfo = { status: VisaStatus; days?: number; permit?: boolean; resident?: boolean }

export const STATUS_META: Record<VisaStatus, { color: string; rank: number }> = {
  self: { color: '#0b7a6e', rank: 0 },
  free: { color: '#19b8a6', rank: 1 },
  arrival: { color: '#ffb627', rank: 2 },
  evisa: { color: '#7c5cff', rank: 3 },
  required: { color: '#ff6b57', rank: 4 },
  banned: { color: '#6e7391', rank: 5 },
  unknown: { color: '', rank: 6 },
}

// Codes written by scripts/build-visa-data.mjs: f<days> / f, o, e, v, n, s.
export function parseVisa(code: string | undefined): VisaInfo {
  if (!code) return { status: 'unknown' }
  if (code === 's') return { status: 'self' }
  if (code[0] === 'f') return { status: 'free', days: code.length > 1 ? Number(code.slice(1)) : undefined }
  if (code === 'o') return { status: 'arrival' }
  if (code === 'e') return { status: 'evisa' }
  if (code === 'v') return { status: 'required' }
  if (code === 'n') return { status: 'banned' }
  return { status: 'unknown' }
}

/** Upgrades a destination to visa-free when a Schengen residence permit covers it. */
export function applyPermit(info: VisaInfo, destCode: string | null, permitCode: string | null): VisaInfo {
  if (!destCode || !isSchengen(permitCode) || !isSchengen(destCode) || info.status === 'self') return info
  if (destCode === permitCode) return { status: 'free', permit: true, resident: true }
  if (info.status === 'free' && (info.days ?? 90) >= 90) return info
  return { status: 'free', days: 90, permit: true }
}

const available = new Set<string>(passportCodes)

/** Countries whose passport we have data for. */
export const passportCountries = countries.filter((country) => {
  const code = flagCode(country.id)
  return code !== null && available.has(code)
})
