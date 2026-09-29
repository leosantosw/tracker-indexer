import { cn } from '@/lib/utils'

export function TrackerAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <div
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-sm font-bold text-indigo-600 uppercase dark:bg-indigo-500/10 dark:text-indigo-300',
        className
      )}
    >
      {name.slice(0, 2)}
    </div>
  )
}
