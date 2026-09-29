import { describe, expect, it } from 'vitest'

import { insertedByLastSync, matchedShare } from '@/features/dashboard/overview-facts'
import type { LastJob } from '@/lib/schemas'

const source = (name: string, inserted: number) => ({
  name,
  state: 'done' as const,
  pages: 1,
  maxPages: null,
  terms: null,
  termIndex: null,
  inserted,
  removed: 0,
})

const lastSync: LastJob = {
  job: 'sync',
  result: 'done',
  reason: null,
  error: null,
  startedAt: '2026-09-29T10:00:00Z',
  finishedAt: '2026-09-29T10:01:00Z',
  progress: {
    phase: 'done',
    sources: [source('comando', 30), source('redes-torrents', 7)],
    tmdb: { state: 'done', total: 0, done: 0, ok: 0, notFound: 0, ambiguous: 0, skipped: 0, failed: 0, startedAt: null, reason: null },
    warnings: [],
  },
}

describe('contexto dos cards do topo', () => {
  it('soma os torrents novos da última atualização', () => {
    expect(insertedByLastSync(lastSync)).toBe(37)
  })

  it('só conta quando a última execução foi uma atualização com progresso', () => {
    expect(insertedByLastSync({ ...lastSync, job: 'enrich' })).toBeNull()
    expect(insertedByLastSync({ ...lastSync, progress: null })).toBeNull()
    expect(insertedByLastSync(null)).toBeNull()
  })

  it('dá a parte das obras que casou com a TMDB', () => {
    expect(matchedShare([{ status: 'ok', total: 96 }, { status: 'not_found', total: 4 }])).toEqual({ matched: 96, share: 96 })
    expect(matchedShare([])).toEqual({ matched: 0, share: 0 })
  })
})
