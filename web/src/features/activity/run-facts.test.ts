import { describe, expect, it } from 'vitest'

import { sourceDetail } from '@/features/activity/run-facts'
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
})
