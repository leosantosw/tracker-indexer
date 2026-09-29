import { formatNumber, plural } from '@/lib/format'
import type { Status } from '@/lib/schemas'

type CacheRow = Status['stats']['cache'][number]

export const cachePercent = (row: Pick<CacheRow, 'cached' | 'checked'>) => (row.checked ? Math.round((row.cached / row.checked) * 100) : 0)

export function cacheRowText(row: CacheRow) {
  if (!row.checked) return `${plural(row.total, 'torrent', 'torrents')} · nenhum verificado ainda`
  const unchecked = row.total - row.checked
  return [
    `${formatNumber(row.cached)} de ${formatNumber(row.checked)} no cache (${cachePercent(row)}%)`,
    unchecked > 0 && `${formatNumber(unchecked)} a verificar`,
  ]
    .filter(Boolean)
    .join(' · ')
}
