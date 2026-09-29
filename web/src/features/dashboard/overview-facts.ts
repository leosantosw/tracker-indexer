import { percent } from '@/lib/format'
import type { LastJob, Status } from '@/lib/schemas'

export function insertedByLastSync(last: LastJob | null) {
  if (last?.job !== 'sync' || !last.progress) return null
  return last.progress.sources.reduce((sum, source) => sum + source.inserted, 0)
}

export function matchedShare(works: Status['stats']['works']) {
  const total = works.reduce((sum, row) => sum + row.total, 0)
  const matched = works.find((row) => row.status === 'ok')?.total ?? 0
  return { matched, share: percent(matched, total) }
}
