import { CalendarCheckIcon, ChevronRightIcon, CopyMinusIcon, FlaskConicalIcon, PlayIcon, PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { Hint } from '@/components/app/hint'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { useJobActions } from '@/features/jobs/use-job-actions'
import { AddTrackerDialog } from '@/features/trackers/add-tracker-dialog'
import { openCheckDialog } from '@/features/trackers/check-store'
import { TrackerAvatar } from '@/features/trackers/tracker-avatar'
import { addedTrackers, availableTrackers } from '@/features/trackers/tracker-lists'
import { formatNumber, plural } from '@/lib/format'
import { CONTENT, MODE_LABEL, SOURCE_SYNC } from '@/lib/labels'
import { paths } from '@/lib/paths'
import type { Source, Status } from '@/lib/schemas'

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
  const { name } = source

  return (
    <li
      className="flex cursor-pointer items-center gap-3 px-4 py-3.5 transition hover:bg-muted/50 sm:gap-4 sm:px-5 sm:py-4"
      onClick={(event) => {
        if (!(event.target as HTMLElement).closest('button, a')) navigate(paths.tracker(name))
      }}
    >
      <TrackerAvatar name={name} />
      <div className="min-w-0 flex-1">
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
      <div className="hidden items-center gap-2 text-muted-foreground md:flex">
        {source.rules.requireYear && (
          <Hint label="Exige ano nos filmes">
            <CalendarCheckIcon className="size-4" aria-label="Exige ano nos filmes" />
          </Hint>
        )}
        {source.rules.dedupe === 'seeders' && (
          <Hint label="Deduplica por seeders">
            <CopyMinusIcon className="size-4" aria-label="Deduplica por seeders" />
          </Hint>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Hint label="Testar: lê a primeira página e mostra o que entraria, sem gravar">
          <Button variant="ghost" size="icon" aria-label={`Testar ${name}`} onClick={() => openCheckDialog(name)}>
            <FlaskConicalIcon />
          </Button>
        </Hint>
        <Hint label={SOURCE_SYNC.hint(name)}>
          <Button variant="ghost" size="icon" aria-label={`${SOURCE_SYNC.action} em ${name}`} disabled={running} onClick={() => actions.sync([name])}>
            <PlayIcon />
          </Button>
        </Hint>
      </div>
      <ChevronRightIcon className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
    </li>
  )
}

export function TrackersList({ sources, status }: { sources: Source[]; status: Status }) {
  const [adding, setAdding] = useState(false)
  const added = addedTrackers(sources)
  const available = availableTrackers(sources)
  const indexed = (name: string) => status.stats.sources.find((row) => row.source === name)?.total ?? 0

  const addButton = (
    <Button variant="outline" disabled={!available.length} onClick={() => setAdding(true)}>
      <PlusIcon data-icon="inline-start" />
      Adicionar tracker
    </Button>
  )

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Trackers</h2>
          <p className="text-sm text-muted-foreground">
            {added.length ? `${plural(added.length, 'tracker adicionado', 'trackers adicionados')} · mudanças valem a partir da próxima execução` : 'Nenhum tracker adicionado ainda.'}
          </p>
        </div>
        <Hint label={available.length ? null : 'Todos os trackers disponíveis já foram adicionados'}>{addButton}</Hint>
      </div>
      <Card className="mt-4 gap-0 rounded-2xl py-0">
        {added.length ? (
          <ul className="divide-y">
            {added.map((source) => (
              <TrackerRow key={source.name} source={source} indexed={indexed(source.name)} running={Boolean(status.job.running)} />
            ))}
          </ul>
        ) : (
          <Empty className="py-10">
            <EmptyHeader>
              <EmptyTitle>Nenhum tracker adicionado</EmptyTitle>
              <EmptyDescription>Adicione um tracker para o catálogo começar a receber torrents.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>{addButton}</EmptyContent>
          </Empty>
        )}
      </Card>
      <AddTrackerDialog open={adding} onOpenChange={setAdding} available={available} />
    </section>
  )
}
