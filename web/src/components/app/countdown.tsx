import { useNow } from '@/hooks/use-now'
import { countdown } from '@/lib/format'

export function Countdown({ to, className }: { to: string; className?: string }) {
  const now = useNow()
  return <span className={className}>{countdown(new Date(to).getTime() - now)}</span>
}
