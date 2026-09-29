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

function Bar({ segments }: { segments: { color: string; share: number; label: string; count: number }[] }) {
  return (
    <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted">
      {segments
        .filter((segment) => segment.count > 0)
        .map((segment) => (
          <div
            key={segment.label}
            className={cn('h-full first:rounded-l-full last:rounded-r-full', segment.color)}
            style={{ width: `${Math.max(segment.share, 1)}%` }}
            title={`${segment.label}: ${formatNumber(segment.count)}`}
          />
        ))}
    </div>
  )
}

export function CatalogCard({ stats }: { stats: Status['stats'] }) {
  const [, setFilters] = useUnmatchedFilters()
  const types = typeBreakdown(stats.types)
  const match = matchBreakdown(stats.works)

  async function showList(status: UnmatchedStatus) {
    await setFilters({ status })
    document.getElementById(UNMATCHED_SECTION_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <StatCard icon={LibraryBigIcon} label="Catálogo">
      <div className="space-y-5">
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
          {types.map((type) => (
            <div key={type.type} className="flex items-baseline gap-2">
              <Dot color={type.color} />
              <span className="text-sm text-muted-foreground">{type.label}</span>
              <span className="text-2xl font-semibold tracking-tight tabular-nums">{formatNumber(type.count)}</span>
              <span className="text-sm text-muted-foreground tabular-nums">{type.share}%</span>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <p className="text-sm font-medium">Match com a TMDB</p>
          <Bar segments={match} />
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
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
                    <button
                      type="button"
                      title="Ver a lista"
                      className="flex items-center gap-1.5 rounded hover:underline"
                      onClick={() => showList(status)}
                    >
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
      </div>
    </StatCard>
  )
}
