import { plural } from '@/lib/format'
import type { UnmatchedStatus } from '@/lib/schemas'

const STATUS_WORKS: Record<UnmatchedStatus, [string, string]> = {
  not_found: ['obra sem match', 'obras sem match'],
  ambiguous: ['obra ambígua', 'obras ambíguas'],
}

type ClearFilters = { total: number; status: UnmatchedStatus | null; tracker: string | null }

export function clearDescription({ total, status, tracker }: ClearFilters) {
  const [one, many] = status ? STATUS_WORKS[status] : ['obra da lista', 'obras da lista']
  const from = tracker ? ` que vieram do ${tracker}` : ''
  return `Apaga os torrents${from} de ${plural(total, one, many)}. Se o tracker publicar esses torrents de novo, eles voltam na próxima atualização.`
}
