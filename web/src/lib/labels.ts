import type { BadgeVariant } from '@/components/ui/badge'
import type { CheckStatus, Content, JobName, JobResult, UnmatchedStatus, WorkType } from '@/lib/schemas'

export const JOBS: Record<JobName, { action: string; running: string; title: string; short: string; hint: string }> = {
  sync: {
    action: 'Atualizar catálogo',
    running: 'atualizando catálogo',
    title: 'Atualização do catálogo',
    short: 'Atualização',
    hint: 'Busca torrents novos nos trackers ativos e depois capas e notas na TMDB',
  },
  enrich: {
    action: 'Buscar capas e notas',
    running: 'buscando capas e notas',
    title: 'Busca de capas e notas',
    short: 'Capas e notas',
    hint: 'Consulta a TMDB só para as obras novas ou com nota vencida, sem tocar nos trackers',
  },
}

export const CONTENT: Record<Content, { label: string; short: string }> = {
  movies: { label: 'Buscar apenas filmes', short: 'filmes' },
  series: { label: 'Buscar apenas séries', short: 'séries' },
  both: { label: 'Buscar filmes e séries', short: 'filmes e séries' },
}

export const SOURCE_SYNC = {
  action: 'Buscar torrents',
  hint: (name: string) => `Busca torrents novos só no ${name} e depois capas e notas`,
}

export const MODE_LABEL = { terms: 'busca', pages: 'catálogo' } as const

export const RESULTS: Record<JobResult, { label: string; variant: BadgeVariant }> = {
  done: { label: 'concluída', variant: 'success' },
  skipped: { label: 'pulada', variant: 'warning' },
  cancelled: { label: 'cancelada', variant: 'warning' },
  failed: { label: 'falhou', variant: 'destructive' },
}

export const REASONS: Record<string, { text: string; fix?: string }> = {
  'no-tmdb-key': {
    text: 'Capas e notas não foram buscadas: falta a TMDB_API_KEY.',
    fix: 'Cadastrar chave',
  },
  'tmdb-failed': {
    text: 'A TMDB falhou: capas e notas ficam para a próxima. Detalhes no log.',
  },
}

export const UNMATCHED_STATUS: Record<UnmatchedStatus, { label: string; variant: BadgeVariant }> = {
  not_found: { label: 'sem match', variant: 'secondary' },
  ambiguous: { label: 'ambígua', variant: 'warning' },
}

export const CHECK_STATUS: Record<CheckStatus, { label: string; variant: BadgeVariant }> = {
  ok: { label: 'entra', variant: 'success' },
  filtered: { label: 'fora do filtro', variant: 'secondary' },
  rejected: { label: 'rejeitado', variant: 'warning' },
  'no-year': { label: 'sem ano', variant: 'warning' },
  'no-magnet': { label: 'sem magnet', variant: 'destructive' },
}

export const WORK_TYPE: Record<WorkType, string> = { movie: 'Filme', series: 'Série' }
