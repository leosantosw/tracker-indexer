import { StepIcon } from '@/components/app/step-icon'
import { Badge } from '@/components/ui/badge'
import { summaryFacts } from '@/features/activity/run-facts'
import { RunWarnings } from '@/features/activity/run-warnings'
import { ago, duration } from '@/lib/format'
import { JOBS, RESULTS } from '@/lib/labels'
import type { JobResult, LastJob, StepState } from '@/lib/schemas'

const RESULT_ICON: Record<JobResult, StepState> = { done: 'done', skipped: 'skipped', cancelled: 'skipped', failed: 'failed' }

export function IdleSummary({ last }: { last: LastJob | null }) {
  if (!last) {
    return (
      <div className="flex min-w-0 items-center gap-3 text-sm">
        <span className="size-2 shrink-0 rounded-full bg-zinc-400" />
        <span className="font-medium">Ociosa</span>
        <span className="truncate text-muted-foreground">nenhuma execução desde que o servidor subiu</span>
      </div>
    )
  }

  const result = RESULTS[last.result]
  const facts = [ago(last.finishedAt), `levou ${duration(last.startedAt, last.finishedAt)}`, ...summaryFacts(last.progress)]

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <StepIcon state={RESULT_ICON[last.result]} />
      <span className="font-medium">{JOBS[last.job].title}</span>
      <Badge variant={result.variant}>{result.label}</Badge>
      <span className="text-muted-foreground">{facts.join(' · ')}</span>
    </div>
  )
}

export function IdleDetails({ last }: { last: LastJob | null }) {
  const warnings = last?.progress?.warnings ?? []
  if (!last?.error && !warnings.length) return null

  return (
    <div className="space-y-3 px-5 pb-4">
      {last?.error && <p className="text-sm text-destructive">{last.error}</p>}
      <RunWarnings warnings={warnings} />
    </div>
  )
}
