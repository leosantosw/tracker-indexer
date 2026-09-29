import { useInfiniteQuery } from '@tanstack/react-query'
import { SparklesIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader } from '@/components/ui/empty'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { openMatchDialog } from '@/features/unmatched/match-store'
import { UNMATCHED_SECTION_ID, useUnmatchedFilters } from '@/features/unmatched/use-unmatched-filters'
import { api } from '@/lib/api'
import { ago, formatNumber, plural } from '@/lib/format'
import { UNMATCHED_STATUS, WORK_TYPE } from '@/lib/labels'
import { queryKeys } from '@/lib/queries'
import { unmatchedStatusSchema, type UnmatchedPage, type UnmatchedWork } from '@/lib/schemas'

const PAGE_SIZE = 10
const ALL = 'all'

const TAB_LABEL = { not_found: 'Sem match', ambiguous: 'Ambíguas' } as const

function RawNames({ work }: { work: UnmatchedWork }) {
  const [first] = work.names
  if (!first) return null
  const all = work.names.map(({ source, rawName }) => `${source}: ${rawName}`).join('\n')

  return (
    <p className="truncate text-xs text-muted-foreground" title={all}>
      <span className="font-medium">{first.source}: </span>
      <code>{first.rawName}</code>
      {work.names.length > 1 && <span className="ml-1 font-medium">+{work.names.length - 1}</span>}
    </p>
  )
}

function WorkRow({ work }: { work: UnmatchedWork }) {
  const status = UNMATCHED_STATUS[work.status]
  const checked = ago(new Date(work.checkedAt * 1000).toISOString())
  const meta = [WORK_TYPE[work.type], plural(work.torrents, 'torrent', 'torrents'), `verificada ${checked}`].join(' · ')

  return (
    <li className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{work.title}</span>
          {work.year && <span className="shrink-0 text-sm text-muted-foreground tabular-nums">({work.year})</span>}
          <Badge variant={status.variant}>{status.label}</Badge>
          <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{meta}</span>
        </div>
        <RawNames work={work} />
      </div>
      <Button variant="outline" size="sm" className="shrink-0" aria-label="Match manual" onClick={() => openMatchDialog(work)}>
        <SparklesIcon data-icon="inline-start" />
        <span className="hidden sm:inline">Match manual</span>
      </Button>
    </li>
  )
}

function Filters({ counts }: { counts: UnmatchedPage['counts'] }) {
  const [filters, setFilters] = useUnmatchedFilters()
  const countOf = (status: string) => counts.byStatus.find((row) => row.status === status)?.total ?? 0
  const all = counts.byStatus.reduce((sum, row) => sum + row.total, 0)
  const tabs = [
    { value: ALL, label: 'Todas', total: all },
    ...unmatchedStatusSchema.options.map((status) => ({ value: status, label: TAB_LABEL[status], total: countOf(status) })),
  ]

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tabs
        value={filters.status ?? ALL}
        onValueChange={(value) => setFilters({ status: value === ALL ? null : unmatchedStatusSchema.parse(value) })}
      >
        <TabsList>
          {tabs.map(({ value, label, total }) => (
            <TabsTrigger key={value} value={value}>
              {label} <span className="text-muted-foreground tabular-nums">{formatNumber(total)}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Select value={filters.tracker ?? ALL} onValueChange={(value) => setFilters({ tracker: value === ALL ? null : value })}>
        <SelectTrigger aria-label="Tracker">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos os trackers</SelectItem>
          {counts.bySource.map(({ source, total }) => (
            <SelectItem key={source} value={source}>
              {source} ({formatNumber(total)})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function UnmatchedSection() {
  const [filters] = useUnmatchedFilters()
  const list = useInfiniteQuery({
    queryKey: [...queryKeys.unmatched, filters],
    queryFn: ({ pageParam }) => api.unmatched({ page: pageParam, limit: PAGE_SIZE, source: filters.tracker, status: filters.status }),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (pages.length * PAGE_SIZE < last.total ? pages.length + 1 : undefined),
  })

  const pages = list.data?.pages ?? []
  const works = pages.flatMap((page) => page.works)
  const latest = pages.at(-1)
  const filtered = Boolean(filters.tracker || filters.status)

  return (
    <section id={UNMATCHED_SECTION_ID} className="scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Sem match na TMDB</h2>
          <p className="text-sm text-muted-foreground">
            Obras com torrent que a TMDB não reconheceu, com o nome que veio de cada tracker.
          </p>
        </div>
        {latest && <Filters counts={latest.counts} />}
      </div>
      <Card className="mt-4 gap-0 rounded-2xl py-0">
        {list.isPending ? (
          <div className="flex justify-center py-8">
            <Spinner className="size-5 text-primary" />
          </div>
        ) : works.length ? (
          <ul className="divide-y">
            {works.map((work) => (
              <WorkRow key={work.id} work={work} />
            ))}
          </ul>
        ) : (
          <Empty className="py-8">
            <EmptyHeader>
              <EmptyDescription>
                {filtered ? 'Nada com esse filtro.' : 'Tudo casado: nenhuma obra sem match na TMDB.'}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        {list.hasNextPage && latest && (
          <div className="border-t px-5 py-3 text-center">
            <Button variant="ghost" disabled={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
              {list.isFetchingNextPage ? 'Carregando…' : `Mostrar mais (${formatNumber(latest.total - works.length)})`}
            </Button>
          </div>
        )}
      </Card>
    </section>
  )
}
