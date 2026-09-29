import type { ReactNode } from 'react'

import { StepIcon } from '@/components/app/step-icon'
import { Progress as ProgressBar } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { eta, sourceDetail, tmdbFacts } from '@/features/activity/run-facts'
import { RunWarnings } from '@/features/activity/run-warnings'
import { useNow } from '@/hooks/use-now'
import { elapsed, percent } from '@/lib/format'
import { JOBS, REASONS } from '@/lib/labels'
import type { RunningJob, SourceProgress, StepState, TmdbProgress } from '@/lib/schemas'
import { cn } from '@/lib/utils'

function Step({ number, title, state, children }: { number: number; title: string; state: StepState; children: ReactNode }) {
  return (
    <li className="relative pl-9">
      <span
        className={cn(
          'absolute top-0 left-0 grid size-6 place-items-center rounded-full text-xs font-semibold',
          state === 'pending' ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground'
        )}
      >
        {number}
      </span>
      <p className="text-sm leading-6 font-semibold">{title}</p>
      <div className="mt-2 space-y-2">{children}</div>
    </li>
  )
}

function SourceRow({ source }: { source: SourceProgress }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <StepIcon state={source.state} />
      <span className={cn('font-medium', source.state === 'pending' && 'text-muted-foreground')}>{source.name}</span>
      <span className="truncate text-muted-foreground tabular-nums">{sourceDetail(source)}</span>
    </div>
  )
}

function TmdbStep({ tmdb, now }: { tmdb: TmdbProgress; now: number }) {
  if (tmdb.state === 'pending') return <p className="text-sm text-muted-foreground">aguardando os trackers</p>
  if (tmdb.state === 'skipped') {
    const reason = tmdb.reason ? REASONS[tmdb.reason]?.text : null
    return <p className="text-sm text-amber-700 dark:text-amber-300">{reason ?? 'pulada'}</p>
  }
  if (tmdb.state === 'failed') return <p className="text-sm text-destructive">a TMDB falhou; capas e notas ficam para a próxima</p>
  if (tmdb.state === 'done' && !tmdb.total) return <p className="text-sm text-muted-foreground">nenhuma obra nova para consultar</p>

  const remaining = tmdb.state === 'running' ? eta(tmdb, now) : null
  return (
    <>
      <ProgressBar value={percent(tmdb.done, tmdb.total)} />
      <p className="text-sm text-muted-foreground tabular-nums">{tmdbFacts(tmdb, remaining).join(' · ')}</p>
    </>
  )
}

export function RunningView({ running }: { running: RunningJob }) {
  const now = useNow()
  const { progress } = running
  const job = JOBS[running.job]
  const title = running.cancelling ? `Cancelando ${job.title.toLowerCase()}…` : `${job.title} em andamento`
  const sourcesState = progress?.sources.every((source) => source.state === 'done') ? 'done' : 'running'

  return (
    <>
      <div className="flex items-center gap-3">
        <Spinner className="text-primary" />
        <h2 className="font-semibold">{title}</h2>
        <span className="ml-auto font-mono text-sm text-muted-foreground tabular-nums">{elapsed(running.startedAt, now)}</span>
      </div>
      {progress ? (
        <>
          <ol className="mt-5 space-y-6">
            {progress.sources.length > 0 && (
              <Step number={1} title="Trackers" state={sourcesState}>
                {progress.sources.map((source) => (
                  <SourceRow key={source.name} source={source} />
                ))}
              </Step>
            )}
            <Step number={progress.sources.length ? 2 : 1} title="Capas e notas" state={progress.tmdb.state}>
              <TmdbStep tmdb={progress.tmdb} now={now} />
            </Step>
          </ol>
          {progress.warnings.length > 0 && (
            <div className="mt-5">
              <RunWarnings warnings={progress.warnings} />
            </div>
          )}
        </>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Iniciando…</p>
      )}
    </>
  )
}
