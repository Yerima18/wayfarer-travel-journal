import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Wayfarer — A Personal Travel Journal',
  description: 'A quiet little atlas for the places you have been and the moments you want to remember.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
