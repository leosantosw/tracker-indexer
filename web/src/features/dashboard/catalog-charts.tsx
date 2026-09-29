import { FilmIcon, SparklesIcon } from 'lucide-react'
import { Label, Pie, PieChart } from 'recharts'

import { StatCard } from '@/components/app/stat-card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { UNMATCHED_SECTION_ID, useUnmatchedFilters } from '@/features/unmatched/use-unmatched-filters'
import { formatNumber, percent } from '@/lib/format'
import type { MatchStatus, Status, UnmatchedStatus } from '@/lib/schemas'
import { cn } from '@/lib/utils'

const typesConfig = {
  movie: { label: 'Filmes', color: 'var(--chart-1)' },
  series: { label: 'Séries', color: 'var(--chart-2)' },
} satisfies ChartConfig

const MATCH: { status: MatchStatus; label: string; color: string }[] = [
  { status: 'ok', label: 'casadas', color: 'bg-emerald-500' },
  { status: 'ambiguous', label: 'ambíguas', color: 'bg-amber-400' },
  { status: 'not_found', label: 'sem match', color: 'bg-zinc-400' },
  { status: 'skipped', label: 'ignoradas', color: 'bg-sky-400' },
  { status: 'pending', label: 'aguardando', color: 'bg-zinc-200 dark:bg-zinc-700' },
]

const isListed = (status: MatchStatus): status is UnmatchedStatus => status === 'ambiguous' || status === 'not_found'

function TypesCard({ types }: { types: Status['stats']['types'] }) {
  const data = (['movie', 'series'] as const).map((type) => ({
    type,
    total: types.find((row) => row.type === type)?.total ?? 0,
    fill: `var(--color-${type})`,
  }))
  const total = data.reduce((sum, slice) => sum + slice.total, 0)

  return (
    <StatCard icon={FilmIcon} label="Filmes e séries">
      {total ? (
        <div className="flex flex-wrap items-center gap-6">
          <ChartContainer config={typesConfig} className="aspect-square size-32 shrink-0">
            <PieChart>
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="type" />} />
              <Pie data={data} dataKey="total" nameKey="type" innerRadius={42} outerRadius={62} paddingAngle={2} strokeWidth={0} isAnimationActive={false}>
                <Label
                  content={({ viewBox }) =>
                    viewBox && 'cx' in viewBox ? (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                        <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-semibold">
                          {formatNumber(total)}
                        </tspan>
                        <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 20} className="fill-muted-foreground text-[10px]">
                          obras
                        </tspan>
                      </text>
                    ) : null
                  }
                />
              </Pie>
            </PieChart>
          </ChartContainer>
          <ul className="min-w-40 flex-1 space-y-3 text-sm">
            {data.map((slice) => (
              <li key={slice.type} className="flex items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: typesConfig[slice.type].color }} />
                <span className="text-muted-foreground">{typesConfig[slice.type].label}</span>
                <span className="ml-auto font-semibold tabular-nums">{formatNumber(slice.total)}</span>
                <span className="w-10 text-right text-muted-foreground tabular-nums">{percent(slice.total, total)}%</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nada no catálogo ainda.</p>
      )}
    </StatCard>
  )
}

function MatchCard({ works }: { works: Status['stats']['works'] }) {
  const [, setFilters] = useUnmatchedFilters()
  const count = (status: MatchStatus) => works.find((row) => row.status === status)?.total ?? 0
  const total = works.reduce((sum, row) => sum + row.total, 0)

  async function showList(status: UnmatchedStatus) {
    await setFilters({ status })
    document.getElementById(UNMATCHED_SECTION_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <StatCard icon={SparklesIcon} label="Match com a TMDB">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        {MATCH.map(({ status, color, label }) => (
          <div key={status} className={color} style={{ width: `${percent(count(status), total)}%` }} title={`${label}: ${count(status)}`} />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm whitespace-nowrap sm:grid-cols-3">
        {MATCH.map(({ status, color, label }) => {
          const value = count(status)
          const clickable = isListed(status) && value > 0
          const content = (
            <>
              <span className={cn('size-2 shrink-0 rounded-full', color)} />
              <span className="text-muted-foreground">{label}</span>
              <span className="ml-auto font-medium tabular-nums">{formatNumber(value)}</span>
            </>
          )
          return (
            <li key={status}>
              {clickable ? (
                <button type="button" title="Ver a lista" className="flex w-full items-center gap-1.5 rounded hover:underline" onClick={() => showList(status)}>
                  {content}
                </button>
              ) : (
                <div className="flex w-full items-center gap-1.5">{content}</div>
              )}
            </li>
          )
        })}
      </ul>
    </StatCard>
  )
}

export function CatalogCharts({ status }: { status: Status }) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <TypesCard types={status.stats.types} />
      <MatchCard works={status.stats.works} />
    </section>
  )
}
