import { ClockIcon, DatabaseIcon, LayersIcon, RefreshCwIcon } from 'lucide-react'
import { Link } from 'react-router'

import { Countdown } from '@/components/app/countdown'
import { BigNumber, Caption, StatCard } from '@/components/app/stat-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ago, formatNumber, plural, when } from '@/lib/format'
import { JOBS, RESULTS } from '@/lib/labels'
import { paths } from '@/lib/paths'
import type { LastJob, Status } from '@/lib/schemas'

function LastRunCard({ last }: { last: LastJob | null }) {
  if (!last) {
    return (
      <StatCard icon={ClockIcon} label="Última execução">
        <p className="text-sm text-muted-foreground">Nenhuma desde que o servidor subiu.</p>
      </StatCard>
    )
  }

  const result = RESULTS[last.result]
  return (
    <StatCard icon={ClockIcon} label="Última execução">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{JOBS[last.job].title}</span>
        <Badge variant={result.variant}>{result.label}</Badge>
      </div>
      <Caption>{ago(last.finishedAt)}</Caption>
      {last.error && <p className="mt-2 line-clamp-2 text-xs text-destructive">{last.error}</p>}
    </StatCard>
  )
}

function NextRunCard({ nextRunAt }: { nextRunAt: string | null }) {
  return (
    <StatCard icon={RefreshCwIcon} label="Próxima atualização">
      {nextRunAt ? (
        <>
          <Countdown
            to={nextRunAt}
            className="block font-mono text-2xl font-semibold tracking-tight text-primary tabular-nums"
          />
          <Caption>{when(nextRunAt)}</Caption>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Sem agendamento.</p>
          <Button variant="link" className="h-auto p-0" asChild>
            <Link to={paths.settings('agendamento')}>Agendar</Link>
          </Button>
        </>
      )}
    </StatCard>
  )
}

export function OverviewCards({ status }: { status: Status }) {
  const { stats, job, schedule } = status
  const torrents = stats.sources.reduce((sum, row) => sum + row.total, 0)
  const matched = stats.works.find((row) => row.status === 'ok')?.total ?? 0

  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard icon={DatabaseIcon} label="Torrents indexados">
        <BigNumber>{formatNumber(torrents)}</BigNumber>
        <Caption>em {plural(stats.sources.length, 'tracker', 'trackers')}</Caption>
      </StatCard>
      <StatCard icon={LayersIcon} label="Obras no catálogo">
        <BigNumber>{formatNumber(matched)}</BigNumber>
        <Caption>casadas com a TMDB</Caption>
      </StatCard>
      <LastRunCard last={job.last} />
      <NextRunCard nextRunAt={schedule.nextRunAt} />
    </section>
  )
}
