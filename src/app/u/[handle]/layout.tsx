import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Wayfarer — a shared travel journal',
  robots: { index: false, follow: false },
}

export default function SharedProfileLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}
