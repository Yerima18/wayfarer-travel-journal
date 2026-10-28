import type { Profile } from '@/lib/avatar'

type AvatarProps = {
  profile: Profile
  photoUrl: string | null
  isLarge?: boolean
}

export default function Avatar({ profile, photoUrl, isLarge = false }: AvatarProps) {
  const className = isLarge ? 'avatar avatar-large' : 'avatar'
  if (profile.kind === 'photo' && photoUrl) {
    return (
      <span className={className} style={{ background: profile.color }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
        <img src={photoUrl} alt="" />
      </span>
    )
  }
  const content = profile.kind === 'sticker' ? profile.sticker : (Array.from(profile.name)[0] ?? '?').toUpperCase()
  return (
    <span className={className} style={{ background: profile.color }} aria-hidden="true">
      {content}
    </span>
  )
}
