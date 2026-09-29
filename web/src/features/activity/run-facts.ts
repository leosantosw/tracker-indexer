import { formatNumber, plural } from '@/lib/format'
import type { Progress, SourceProgress, TmdbProgress } from '@/lib/schemas'

export const insertedText = (inserted: number) => (inserted ? `+${formatNumber(inserted)} novos` : 'nada novo')

export function sourceDetail(source: SourceProgress) {
  if (source.state === 'pending') return 'na fila'
  if (source.state === 'done') {
    const removed = source.removed ? ` · ${plural(source.removed, 'removido', 'removidos')} pelas regras` : ''
    const inCategories = source.byCategory && source.terms ? ` em ${plural(source.terms, 'categoria', 'categorias')}` : ''
    return `${plural(source.pages, 'página', 'páginas')}${inCategories} · ${insertedText(source.inserted)}${removed}`
  }
  const where = source.terms
    ? `${source.byCategory ? 'categoria' : 'termo'} ${(source.termIndex ?? 0) + 1} de ${source.terms}`
    : `página ${source.pages + 1}${source.maxPages ? ` de ${source.maxPages}` : ''}`
  return `${where} · ${insertedText(source.inserted)}`
}

export function eta(tmdb: TmdbProgress, now: number) {
  if (!tmdb.startedAt || tmdb.done < 5) return null
  const spent = now - new Date(tmdb.startedAt).getTime()
  const left = ((tmdb.total - tmdb.done) * spent) / tmdb.done / 1000
  if (left < 60) return `~${Math.max(5, Math.round(left / 5) * 5)} s`
  return `~${Math.round(left / 60)} min`
}

export function tmdbFacts(tmdb: TmdbProgress, remaining: string | null) {
  const unmatched = tmdb.notFound + tmdb.ambiguous
  return [
    `${formatNumber(tmdb.done)} de ${plural(tmdb.total, 'obra', 'obras')}`,
    remaining,
    `${formatNumber(tmdb.ok)} casadas`,
    unmatched ? `${formatNumber(unmatched)} sem match` : null,
    tmdb.failed ? `${formatNumber(tmdb.failed)} com erro` : null,
  ].filter(Boolean)
}

export function summaryFacts(progress?: Progress | null) {
  if (!progress) return []
  const inserted = progress.sources.reduce((sum, source) => sum + source.inserted, 0)
  const { tmdb } = progress
  const done = tmdb.state === 'done'
  const unmatched = tmdb.notFound + tmdb.ambiguous
  return [
    progress.sources.length > 0 && insertedText(inserted).replace('novos', 'torrents novos'),
    done && tmdb.total > 0 && `${plural(tmdb.ok, 'obra casada', 'obras casadas')} na TMDB`,
    done && unmatched > 0 && `${formatNumber(unmatched)} sem match`,
    done && tmdb.total === 0 && 'nenhuma obra nova para a TMDB',
  ].filter(Boolean)
}
