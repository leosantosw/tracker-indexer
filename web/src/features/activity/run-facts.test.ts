import { describe, expect, it } from 'vitest'

import { cacheFacts, sourceDetail, summaryFacts } from '@/features/activity/run-facts'
import type { SourceProgress } from '@/lib/schemas'

const progress = (over: Partial<SourceProgress> = {}): SourceProgress => ({
  name: 'amigos-share-club',
  state: 'done',
  pages: 10,
  maxPages: 3,
  terms: 4,
  termIndex: 3,
  inserted: 745,
  removed: 0,
  byCategory: true,
  ...over,
})

describe('detalhe do tracker na execução', () => {
  it('tracker com categorias diz em quantas as páginas foram lidas', () => {
    expect(sourceDetail(progress())).toBe('10 páginas em 4 categorias · +745 novos')
  })

  it('durante a varredura mostra a categoria atual', () => {
    expect(sourceDetail(progress({ state: 'running', termIndex: 1 }))).toBe('categoria 2 de 4 · +745 novos')
  })

  it('tracker por termo continua falando em termo', () => {
    expect(sourceDetail(progress({ state: 'running', byCategory: false, termIndex: 0 }))).toBe('termo 1 de 4 · +745 novos')
  })

  it('verificação de cache sozinha resume só o cache', () => {
    const cache = { state: 'done' as const, total: 828, done: 828, cached: 234, reason: null }

    expect(summaryFacts({ phase: 'done', sources: [], tmdb: null, cache, warnings: [] })).toEqual(['234 de 828 no cache (28%)'])
  })

  it('durante a verificação mostra o avanço e o que já achou', () => {
    expect(cacheFacts({ state: 'running', total: 828, done: 0, cached: 0, reason: null })).toEqual(['0 de 828 torrents'])
    expect(cacheFacts({ state: 'running', total: 828, done: 500, cached: 100, reason: null })).toEqual(['500 de 828 torrents', '100 de 500 no cache (20%)'])
  })
})
