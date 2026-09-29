import { StepIcon } from '@/components/app/step-icon'
import { Badge } from '@/components/ui/badge'
import { summaryFacts } from '@/features/activity/run-facts'
import { RunWarnings } from '@/features/activity/run-warnings'
import { ago, duration } from '@/lib/format'
import { JOBS, RESULTS } from '@/lib/labels'
import type { JobResult, LastJob, StepState } from '@/lib/schemas'

const RESULT_ICON: Record<JobResult, StepState> = { done: 'done', skipped: 'skipped', cancelled: 'skipped', failed: 'failed' }

export function IdleView({ last }: { last: LastJob | null }) {
  if (!last) {
    return (
      <>
        <h2 className="font-semibold">Atividade</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Nenhuma execução desde que o servidor subiu. Clique em Atualizar catálogo para começar.
        </p>
      </>
    )
  }

  const result = RESULTS[last.result]
  const facts = summaryFacts(last.progress)
  const warnings = last.progress?.warnings ?? []

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <StepIcon state={RESULT_ICON[last.result]} />
        <h2 className="font-semibold">{JOBS[last.job].title}</h2>
        <Badge variant={result.variant}>{result.label}</Badge>
        <span className="text-sm text-muted-foreground">
          {ago(last.finishedAt)} · levou {duration(last.startedAt, last.finishedAt)}
        </span>
      </div>
      {facts.length > 0 && <p className="mt-2 pl-7 text-sm text-muted-foreground">{facts.join(' · ')}</p>}
      {last.error && <p className="mt-2 pl-7 text-sm text-destructive">{last.error}</p>}
      {warnings.length > 0 && (
        <div className="mt-4">
          <RunWarnings warnings={warnings} />
        </div>
      )}
    </>
  )
}
