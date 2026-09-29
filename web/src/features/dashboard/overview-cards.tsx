import { ClockIcon, DatabaseIcon, LayersIcon, RefreshCwIcon } from 'lucide-react'
import { Link } from 'react-router'

import { Countdown } from '@/components/app/countdown'
import { BigNumber, Caption, StatCard } from '@/components/app/stat-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { insertedByLastSync, matchedShare } from '@/features/dashboard/overview-facts'
import { useNow } from '@/hooks/use-now'
import { ago, duration, formatNumber, formatShare, plural, when } from '@/lib/format'
import { JOBS, RESULTS } from '@/lib/labels'
import { paths } from '@/lib/paths'
import type { LastJob, ScheduleStatus, Status } from '@/lib/schemas'

const MINUTE = 60 * 1000

function TorrentsCard({ stats, last }: { stats: Status['stats']; last: LastJob | null }) {
  const torrents = stats.sources.reduce((sum, row) => sum + row.total, 0)
  const inserted = insertedByLastSync(last)

  return (
    <StatCard icon={DatabaseIcon} label="Torrents indexados">
      <BigNumber>{formatNumber(torrents)}</BigNumber>
      <Caption>
        {inserted === null
          ? `em ${plural(stats.sources.length, 'tracker', 'trackers')}`
          : `+${formatNumber(inserted)} na última atualização`}
      </Caption>
    </StatCard>
  )
}

function WorksCard({ works }: { works: Status['stats']['works'] }) {
  const { matched, share } = matchedShare(works)

  return (
    <StatCard icon={LayersIcon} label="Obras no catálogo">
      <BigNumber>{formatNumber(matched)}</BigNumber>
      <Caption>{formatShare(share)} identificadas pela TMDB</Caption>
    </StatCard>
  )
}

function LastRunCard({ last }: { last: LastJob | null }) {
  const now = useNow(Boolean(last), MINUTE)

  if (!last) {
    return (
      <StatCard icon={ClockIcon} label="Última execução">
        <BigNumber className="text-xl">Nunca executado</BigNumber>
        <Caption>Nenhuma execução registrada</Caption>
      </StatCard>
    )
  }

  const result = RESULTS[last.result]
  return (
    <StatCard icon={ClockIcon} label="Última execução">
      <BigNumber>{ago(last.finishedAt, now)}</BigNumber>
      <div className="mt-1 flex items-center gap-2 text-sm whitespace-nowrap text-muted-foreground">
        <Badge variant={result.variant}>{result.label}</Badge>
        <span className="truncate">
          {duration(last.startedAt, last.finishedAt)} · {JOBS[last.job].short}
        </span>
      </div>
      {last.error && <p className="mt-2 line-clamp-2 text-xs text-destructive">{last.error}</p>}
    </StatCard>
  )
}

function NextRunCard({ schedule }: { schedule: ScheduleStatus }) {
  if (!schedule.nextRunAt) {
    return (
      <StatCard icon={RefreshCwIcon} label="Próxima atualização">
        <BigNumber className="text-muted-foreground">—</BigNumber>
        <Button variant="link" className="mt-1 h-auto p-0" asChild>
          <Link to={paths.settings('agendamento')}>{schedule.enabled ? 'Ver agendamento' : 'Agendar'}</Link>
        </Button>
      </StatCard>
    )
  }

  return (
    <StatCard icon={RefreshCwIcon} label="Próxima atualização">
      <BigNumber className="font-mono text-primary">
        <Countdown to={schedule.nextRunAt} />
      </BigNumber>
      <Caption>{when(schedule.nextRunAt)}</Caption>
    </StatCard>
  )
}

export function OverviewCards({ status }: { status: Status }) {
  const { stats, job, schedule } = status

  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <TorrentsCard stats={stats} last={job.last} />
      <WorksCard works={stats.works} />
      <LastRunCard last={job.last} />
      <NextRunCard schedule={schedule} />
    </section>
  )
}
