import { percent } from '@/lib/format'
import type { MatchStatus, Status, WorkType } from '@/lib/schemas'

export const MATCH_SEGMENTS: { status: MatchStatus; label: string; color: string }[] = [
  { status: 'ok', label: 'casadas', color: 'bg-emerald-500' },
  { status: 'ambiguous', label: 'ambíguas', color: 'bg-amber-400' },
  { status: 'not_found', label: 'sem match', color: 'bg-zinc-400' },
  { status: 'pending', label: 'aguardando', color: 'bg-zinc-200 dark:bg-zinc-700' },
]

export const TYPE_SEGMENTS: { type: WorkType; label: string; color: string }[] = [
  { type: 'movie', label: 'Filmes', color: 'bg-chart-1' },
  { type: 'series', label: 'Séries', color: 'bg-chart-2' },
]

export const countedWorks = (works: Status['stats']['works']) => works.filter((row) => row.status !== 'skipped')

export function matchBreakdown(works: Status['stats']['works']) {
  const total = countedWorks(works).reduce((sum, row) => sum + row.total, 0)
  return MATCH_SEGMENTS.map((segment) => {
    const count = works.find((row) => row.status === segment.status)?.total ?? 0
    return { ...segment, count, share: percent(count, total) }
  })
}

export function typeBreakdown(types: Status['stats']['types']) {
  const total = types.reduce((sum, row) => sum + row.total, 0)
  return TYPE_SEGMENTS.map((segment) => {
    const count = types.find((row) => row.type === segment.type)?.total ?? 0
    return { ...segment, count, share: percent(count, total) }
  })
}
