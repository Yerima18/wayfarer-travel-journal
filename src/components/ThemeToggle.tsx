'use client'

// The theme lives on <html data-theme>, set before first paint by the script in layout.tsx.
export default function ThemeToggle() {
  function toggle() {
    const root = document.documentElement
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark'
    root.dataset.theme = next
    try {
      window.localStorage.setItem('wayfarer.theme', next)
    } catch {
      // Theme still switches for this visit if storage is unavailable.
    }
  }

  return (
    <button className="theme-toggle" type="button" onClick={toggle} aria-label="Switch between light and dark mode" title="Light / dark mode">
      <svg className="icon-moon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8Z" /></svg>
      <svg className="icon-sun" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
    </button>
  )
}
