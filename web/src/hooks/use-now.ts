import { useEffect, useState } from 'react'

export function useNow(active = true, intervalMs = 1000) {
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [active, intervalMs])

  return now
}
