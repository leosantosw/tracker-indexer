import { ChevronRightIcon, FlaskConicalIcon, PlayIcon } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { Hint } from '@/components/app/hint'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { useJobActions } from '@/features/jobs/use-job-actions'
import { openCheckDialog } from '@/features/trackers/check-store'
import { TrackerAvatar } from '@/features/trackers/tracker-avatar'
import { formatNumber } from '@/lib/format'
import { CONTENT, MODE_LABEL, SOURCE_SYNC } from '@/lib/labels'
import { paths } from '@/lib/paths'
import { useSaveSettings } from '@/lib/queries'
import type { Source, Status } from '@/lib/schemas'
import { cn } from '@/lib/utils'

function summary(source: Source, indexed: number) {
  return [
    `${formatNumber(indexed)} torrents`,
    CONTENT[source.content].short,
    `${source.rps} req/s`,
    source.mode === 'terms' && `${source.terms?.length ?? 0} termos`,
  ]
    .filter(Boolean)
    .join(' · ')
}

function TrackerRow({ source, indexed, running }: { source: Source; indexed: number; running: boolean }) {
  const navigate = useNavigate()
  const actions = useJobActions()
  const save = useSaveSettings()
  const { name, enabled } = source

  function toggle(next: boolean) {
    save.mutate(
      { sources: { [name]: { enabled: next } } },
      { onSuccess: () => toast.success(`${name} ${next ? 'ativado' : 'desativado'}`) }
    )
  }

  return (
    <li
      className="flex cursor-pointer items-center gap-3 px-4 py-3.5 transition hover:bg-muted/50 sm:gap-4 sm:px-5 sm:py-4"
      onClick={(event) => {
        if (!(event.target as HTMLElement).closest('button, a')) navigate(paths.tracker(name))
      }}
    >
      <TrackerAvatar source={source} />
      <div className={cn('min-w-0 flex-1', !enabled && 'opacity-60')}>
        <div className="flex items-center gap-2">
          <Link to={paths.tracker(name)} className="truncate font-semibold hover:underline">
            {name}
          </Link>
          <Badge variant="secondary" className="hidden sm:inline-flex">
            {MODE_LABEL[source.mode]}
          </Badge>
        </div>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">{summary(source, indexed)}</p>
      </div>
      <div className="hidden gap-1.5 md:flex">
        {source.rules.requireYear && <Badge variant="info">exige ano</Badge>}
        {source.rules.dedupe === 'seeders' && <Badge variant="info">dedupe</Badge>}
      </div>
      <div className="flex items-center gap-1">
        <Hint label="Testar: lê a primeira página e mostra o que entraria, sem gravar">
          <Button variant="ghost" size="icon" aria-label={`Testar ${name}`} onClick={() => openCheckDialog(name)}>
            <FlaskConicalIcon />
          </Button>
        </Hint>
        <Hint label={enabled ? SOURCE_SYNC.hint(name) : 'Ative o tracker para buscar torrents'}>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`${SOURCE_SYNC.action} em ${name}`}
            disabled={!enabled || running}
            onClick={() => actions.sync([name])}
          >
            <PlayIcon />
          </Button>
        </Hint>
        <Switch
          checked={enabled}
          disabled={save.isPending}
          aria-label={`${enabled ? 'Desativar' : 'Ativar'} ${name}`}
          onCheckedChange={toggle}
        />
      </div>
      <ChevronRightIcon className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
    </li>
  )
}

export function TrackersList({ sources, status }: { sources: Source[]; status: Status }) {
  const indexed = (name: string) => status.stats.sources.find((row) => row.source === name)?.total ?? 0
  const active = sources.filter((source) => source.enabled).length

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Trackers</h2>
          <p className="text-sm text-muted-foreground">Mudanças valem a partir da próxima execução.</p>
        </div>
        <span className="text-sm text-muted-foreground">
          {active} de {sources.length} ativos
        </span>
      </div>
      <Card className="mt-4 gap-0 rounded-2xl py-0">
        <ul className="divide-y">
          {sources.map((source) => (
            <TrackerRow key={source.name} source={source} indexed={indexed(source.name)} running={Boolean(status.job.running)} />
          ))}
        </ul>
      </Card>
    </section>
  )
}
