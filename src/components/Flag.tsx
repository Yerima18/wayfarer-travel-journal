import { flagSrc } from '@/lib/flags'

type FlagProps = { countryId: string; className?: string }

export default function Flag({ countryId, className = 'flag' }: FlagProps) {
  const src = flagSrc(countryId)
  if (!src) return <span className={`${className} flag-none`} aria-hidden="true">🌍</span>
  // Flags are small static SVGs, so next/image optimisation adds nothing here.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className} src={src} alt="" width={24} height={18} loading="lazy" decoding="async" />
}
