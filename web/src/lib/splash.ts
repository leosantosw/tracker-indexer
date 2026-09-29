const MIN_VISIBLE_MS = 700
const FADE_MS = 400

export function hideSplash() {
  const splash = document.getElementById('splash')
  if (!splash || splash.dataset.state) return
  splash.dataset.state = 'waiting'
  const wait = Math.max(0, MIN_VISIBLE_MS - performance.now())
  setTimeout(() => {
    splash.dataset.state = 'leaving'
    setTimeout(() => splash.remove(), FADE_MS)
  }, wait)
}
