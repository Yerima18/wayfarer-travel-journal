import { useEffect, useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import { defaultProfile, readProfile, removeAvatarFile, signedAvatarUrl, uploadAvatar, type Profile } from '@/lib/avatar'

/** The signed-in person's name and avatar, kept in their account so it follows them across devices. */
export function useProfile(userId: string, email: string) {
  const [profile, setProfile] = useState<Profile>(() => defaultProfile(userId, email))
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true
    async function load() {
      const { data } = await createClient().auth.getUser()
      if (!isActive || !data.user) return
      const loaded = readProfile(data.user.user_metadata, userId, email)
      const url = await signedAvatarUrl(loaded.photoPath).catch(() => null)
      if (!isActive) return
      setProfile(loaded)
      setPhotoUrl(url)
    }
    void load()
    return () => {
      isActive = false
    }
  }, [userId, email])

  /** Saves the profile; a new picture is uploaded first and the one it replaces is deleted after. */
  async function saveProfile(next: Profile, newPhoto: Blob | null): Promise<void> {
    const newPath = newPhoto ? await uploadAvatar(userId, newPhoto) : ''
    const photoPath = newPath || (next.kind === 'photo' ? profile.photoPath : '')
    const saved: Profile = { ...next, name: next.name.trim() || defaultProfile(userId, email).name, photoPath }

    const { error } = await createClient().auth.updateUser({ data: { profile: saved } })
    if (error) {
      await removeAvatarFile(newPath).catch(() => undefined)
      throw error
    }
    if (profile.photoPath && profile.photoPath !== photoPath) {
      await removeAvatarFile(profile.photoPath).catch(() => undefined)
    }
    const url = await signedAvatarUrl(photoPath).catch(() => null)
    setProfile(saved)
    setPhotoUrl(url)
  }

  return { profile, photoUrl, saveProfile }
}
