import type { MetadataRoute } from 'next'

const BRAND_COLOR = '#4f35d9'
const PAPER_COLOR = '#fff8ee'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Wayfarer — A Personal Travel Journal',
    short_name: 'Wayfarer',
    description: 'A colourful atlas for the places you have been and the ones you dream of.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: PAPER_COLOR,
    theme_color: BRAND_COLOR,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
