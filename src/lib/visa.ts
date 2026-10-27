import { countries } from './countries'
import { flagCode } from './flags'
import passportCodes from './visaPassports.json'

export type VisaStatus = 'self' | 'free' | 'arrival' | 'evisa' | 'required' | 'banned' | 'unknown'
export type VisaInfo = { status: VisaStatus; days?: number }

export const STATUS_META: Record<VisaStatus, { label: string; color: string; rank: number }> = {
  self: { label: 'Your passport’s country', color: '#0b7a6e', rank: 0 },
  free: { label: 'Visa-free', color: '#19b8a6', rank: 1 },
  arrival: { label: 'Visa on arrival', color: '#ffb627', rank: 2 },
  evisa: { label: 'e-Visa / travel authorisation', color: '#7c5cff', rank: 3 },
  required: { label: 'Visa required', color: '#ff6b57', rank: 4 },
  banned: { label: 'Entry not permitted', color: '#6e7391', rank: 5 },
  unknown: { label: 'No data', color: '', rank: 6 },
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

export function describeVisa(info: VisaInfo): string {
  switch (info.status) {
    case 'self': return 'This is your own country.'
    case 'free': return info.days ? `Visa-free for up to ${info.days} days.` : 'Visa-free entry.'
    case 'arrival': return 'You get a visa when you arrive.'
    case 'evisa': return 'Apply online (e-visa or electronic travel authorisation) before you travel.'
    case 'required': return 'You need to get a visa before you travel.'
    case 'banned': return 'Entry is not permitted for this passport.'
    default: return 'We have no visa data for this one.'
  }
}

const available = new Set<string>(passportCodes)

/** Countries whose passport we have data for. */
export const passportCountries = countries.filter((country) => {
  const code = flagCode(country.id)
  return code !== null && available.has(code)
})
