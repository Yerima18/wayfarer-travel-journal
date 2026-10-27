import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Wayfarer — A Personal Travel Journal',
  description: 'A quiet little atlas for the places you have been and the moments you want to remember.',
}

// Browser auto-translate swaps text nodes for its own elements, which makes React throw when it
// later updates them and blanks the page. Ignoring those stale-node calls keeps translated pages alive.
const translateGuard = `(function(){var n=Node.prototype,r=n.removeChild,i=n.insertBefore;n.removeChild=function(c){if(c&&c.parentNode!==this){return c}return r.apply(this,arguments)};n.insertBefore=function(c,f){if(f&&f.parentNode!==this){return c}return i.apply(this,arguments)}})();`

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: translateGuard }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
