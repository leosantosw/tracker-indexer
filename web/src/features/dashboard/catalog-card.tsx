import { LibraryBigIcon } from 'lucide-react'

import { StatCard } from '@/components/app/stat-card'
import { matchBreakdown, typeBreakdown } from '@/features/dashboard/catalog-stats'
import { UNMATCHED_SECTION_ID, useUnmatchedFilters } from '@/features/unmatched/use-unmatched-filters'
import { formatNumber } from '@/lib/format'
import type { MatchStatus, Status, UnmatchedStatus } from '@/lib/schemas'
import { cn } from '@/lib/utils'

const isListed = (status: MatchStatus): status is UnmatchedStatus => status === 'ambiguous' || status === 'not_found'

function Dot({ color }: { color: string }) {
  return <span className={cn('size-2 shrink-0 rounded-full', color)} />
}

function BlockTitle({ children }: { children: string }) {
  return <p className="text-sm font-medium">{children}</p>
}

function TypesBlock({ types }: { types: Status['stats']['types'] }) {
  return (
    <div className="space-y-3">
      <BlockTitle>Filmes e séries</BlockTitle>
      <div className="grid grid-cols-[auto_auto_auto_1fr] items-center gap-x-4 gap-y-2.5 text-sm">
        {typeBreakdown(types).map((type) => (
          <div key={type.type} className="contents">
            <span className="text-muted-foreground">{type.label}</span>
            <span className="text-right font-semibold tabular-nums">{formatNumber(type.count)}</span>
            <span className="w-10 text-right text-muted-foreground tabular-nums">{type.share}%</span>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className={cn('h-full rounded-full', type.color)} style={{ width: `${type.share}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MatchBlock({ works }: { works: Status['stats']['works'] }) {
  const [, setFilters] = useUnmatchedFilters()
  const match = matchBreakdown(works)

  async function showList(status: UnmatchedStatus) {
    await setFilters({ status })
    document.getElementById(UNMATCHED_SECTION_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="space-y-3">
      <BlockTitle>Match com a TMDB</BlockTitle>
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted">
        {match
          .filter((segment) => segment.count > 0)
          .map((segment) => (
            <div
              key={segment.status}
              className={cn('h-full first:rounded-l-full last:rounded-r-full', segment.color)}
              style={{ width: `${Math.max(segment.share, 1)}%` }}
              title={`${segment.label}: ${formatNumber(segment.count)}`}
            />
          ))}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
        {match.map((segment) => {
          const { status } = segment
          const content = (
            <>
              <Dot color={segment.color} />
              <span className="text-muted-foreground">{segment.label}</span>
              <span className="font-medium tabular-nums">{formatNumber(segment.count)}</span>
              <span className="text-muted-foreground tabular-nums">{segment.share}%</span>
            </>
          )
          return (
            <li key={status}>
              {isListed(status) && segment.count > 0 ? (
                <button type="button" title="Ver a lista" className="flex items-center gap-1.5 rounded hover:underline" onClick={() => showList(status)}>
                  {content}
                </button>
              ) : (
                <div className="flex items-center gap-1.5">{content}</div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function CatalogCard({ stats }: { stats: Status['stats'] }) {
  return (
    <StatCard icon={LibraryBigIcon} label="Catálogo">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-10">
        <TypesBlock types={stats.types} />
        <MatchBlock works={stats.works} />
      </div>
    </StatCard>
  )
}
