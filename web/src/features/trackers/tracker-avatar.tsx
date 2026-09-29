import type { Source } from '@/lib/schemas'
import { cn } from '@/lib/utils'

export function TrackerAvatar({ source, className }: { source: Source; className?: string }) {
  return (
    <div
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-xl text-sm font-bold uppercase',
        source.enabled ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300' : 'bg-muted text-muted-foreground',
        className
      )}
    >
      {source.name.slice(0, 2)}
    </div>
  )
}
