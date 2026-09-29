import { useNow } from '@/hooks/use-now'
import { useConnectionStore } from '@/features/live/connection-store'
import { elapsed } from '@/lib/format'
import { JOBS } from '@/lib/labels'
import type { JobStatus } from '@/lib/schemas'
import { cn } from '@/lib/utils'

const PILL = {
  idle: { pill: 'bg-muted text-muted-foreground', dot: 'bg-zinc-400' },
  running: { pill: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300', dot: 'bg-indigo-500 animate-pulse' },
  cancelling: { pill: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300', dot: 'bg-amber-500 animate-pulse' },
  offline: { pill: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300', dot: 'bg-rose-500' },
}

function pillState(job: JobStatus, connected: boolean): keyof typeof PILL {
  if (!connected) return 'offline'
  if (!job.running) return 'idle'
  return job.running.cancelling ? 'cancelling' : 'running'
}

export function JobPill({ job }: { job: JobStatus }) {
  const connected = useConnectionStore((state) => state.connected)
  const now = useNow(Boolean(job.running))
  const state = pillState(job, connected)
  const { running } = job

  const text =
    state === 'offline'
      ? 'reconectando…'
      : !running
        ? 'ocioso'
        : `${running.cancelling ? `cancelando ${JOBS[running.job].title.toLowerCase()}` : JOBS[running.job].running} · ${elapsed(running.startedAt, now)}`

  return (
    <span className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium', PILL[state].pill)}>
      <span className={cn('size-2 rounded-full', PILL[state].dot)} />
      <span className="tabular-nums">{text}</span>
    </span>
  )
}
