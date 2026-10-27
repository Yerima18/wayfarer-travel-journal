// Schengen Area members (as of 2025), as ISO 3166-1 alpha-2 codes.
// A valid residence permit from one of these lets the holder visit the others for up to 90 days in any 180.
export const SCHENGEN = new Set([
  'at', 'be', 'bg', 'hr', 'cz', 'dk', 'ee', 'fi', 'fr', 'de', 'gr', 'hu', 'is', 'it', 'lv', 'li', 'lt',
  'lu', 'mt', 'nl', 'no', 'pl', 'pt', 'ro', 'sk', 'si', 'es', 'se', 'ch',
])

export const isSchengen = (code: string | null | undefined) => Boolean(code) && SCHENGEN.has(String(code).toLowerCase())
