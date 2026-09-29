import { Link2Icon, LibraryBigIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { StatCard } from '@/components/app/stat-card'
import { matchBreakdown, typeBreakdown } from '@/features/dashboard/catalog-stats'
import { UNMATCHED_SECTION_ID, useUnmatchedFilters } from '@/features/unmatched/use-unmatched-filters'
import { formatNumber } from '@/lib/format'
import type { MatchStatus, Status, UnmatchedStatus } from '@/lib/schemas'
import { cn } from '@/lib/utils'

const isListed = (status: MatchStatus): status is UnmatchedStatus => status === 'ambiguous' || status === 'not_found'

function TypesCard({ types }: { types: Status['stats']['types'] }) {
  return (
    <StatCard icon={LibraryBigIcon} label="Filmes e séries">
      <div className="grid grid-cols-[auto_auto_auto_1fr] items-center gap-x-5 gap-y-3">
        {typeBreakdown(types).map((type) => (
          <div key={type.type} className="contents">
            <span className="text-sm text-muted-foreground">{type.label}</span>
            <span className="text-right text-xl font-semibold tracking-tight tabular-nums">{formatNumber(type.count)}</span>
            <span className="w-10 text-right text-sm text-muted-foreground tabular-nums">{type.share}%</span>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className={cn('h-full rounded-full', type.color)} style={{ width: `${type.share}%` }} />
            </div>
          </div>
        ))}
      </div>
    </StatCard>
  )
}

function Legend({ color, label, count, share }: { color: string; label: string; count: number; share: number }) {
  return (
    <>
      <span className="flex items-center gap-2 text-muted-foreground">
        <span className={cn('size-2 shrink-0 rounded-full', color)} />
        {label}
      </span>
      <span className="mt-1 flex items-baseline gap-3 pl-4">
        <span className="font-semibold tabular-nums">{formatNumber(count)}</span>
        <span className="text-muted-foreground tabular-nums">{share}%</span>
      </span>
    </>
  )
}

function LegendItem({ clickable, onClick, children }: { clickable: boolean; onClick: () => void; children: ReactNode }) {
  if (!clickable) return <div className="flex flex-col">{children}</div>
  return (
    <button type="button" title="Ver a lista" className="flex flex-col rounded text-left hover:underline" onClick={onClick}>
      {children}
    </button>
  )
}

function MatchCard({ works }: { works: Status['stats']['works'] }) {
  const [, setFilters] = useUnmatchedFilters()
  const match = matchBreakdown(works)

  async function showList(status: UnmatchedStatus) {
    await setFilters({ status })
    document.getElementById(UNMATCHED_SECTION_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <StatCard icon={Link2Icon} label="Match com a TMDB">
      <div className="space-y-4">
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted">
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
        <ul className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-4">
          {match.map((segment) => {
            const { status } = segment
            return (
              <li key={status}>
                <LegendItem clickable={isListed(status) && segment.count > 0} onClick={() => isListed(status) && showList(status)}>
                  <Legend color={segment.color} label={segment.label} count={segment.count} share={segment.share} />
                </LegendItem>
              </li>
            )
          })}
        </ul>
      </div>
    </StatCard>
  )
}

export function CatalogCards({ stats }: { stats: Status['stats'] }) {
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <TypesCard types={stats.types} />
      <MatchCard works={stats.works} />
    </section>
  )
}
