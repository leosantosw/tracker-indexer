import { countedWorks } from '@/features/dashboard/catalog-stats'
import { formatNumber, plural } from '@/lib/format'
import type { LastJob, Status } from '@/lib/schemas'

export function insertedByLastSync(last: LastJob | null) {
  if (last?.job !== 'sync' || !last.progress) return null
  return last.progress.sources.reduce((sum, source) => sum + source.inserted, 0)
}

export function matchedShare(works: Status['stats']['works']) {
  const total = countedWorks(works).reduce((sum, row) => sum + row.total, 0)
  const matched = works.find((row) => row.status === 'ok')?.total ?? 0
  return { matched, share: total ? Math.round((matched / total) * 1000) / 10 : 0 }
}

export function torrentsCaption(last: LastJob | null, trackers: number) {
  const inserted = insertedByLastSync(last)
  if (inserted === null) return `em ${plural(trackers, 'tracker', 'trackers')}`
  return inserted ? `+${formatNumber(inserted)} na última atualização` : 'nenhum torrent novo'
}
