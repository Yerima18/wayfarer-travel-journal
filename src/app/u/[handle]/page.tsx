import { Suspense } from 'react'

import SharedProfileScreen from '@/components/SharedProfileScreen'

export default function SharedProfilePage() {
  return (
    <Suspense fallback={null}>
      <SharedProfileScreen />
    </Suspense>
  )
}
