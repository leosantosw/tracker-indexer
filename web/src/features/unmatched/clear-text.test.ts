import { describe, expect, it } from 'vitest'

import { clearDescription } from '@/features/unmatched/clear-text'

describe('texto da confirmação de apagar sem match', () => {
  it('sem filtro fala das obras da lista', () => {
    expect(clearDescription({ total: 101, status: null, tracker: null })).toMatch(/^Apaga os torrents de 101 obras da lista\./)
  })

  it('com status e tracker, diz exatamente o que sai', () => {
    expect(clearDescription({ total: 1, status: 'ambiguous', tracker: 'comando' })).toMatch(
      /^Apaga os torrents que vieram do comando de 1 obra ambígua\./
    )
  })
})
