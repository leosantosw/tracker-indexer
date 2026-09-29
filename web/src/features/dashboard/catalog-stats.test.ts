import { describe, expect, it } from 'vitest'

import { matchBreakdown, typeBreakdown } from '@/features/dashboard/catalog-stats'

describe('números do card de catálogo', () => {
  it('dá contagem e porcentagem de cada status, com zero para o que não veio', () => {
    const breakdown = matchBreakdown([
      { status: 'ok', total: 90 },
      { status: 'ambiguous', total: 6 },
      { status: 'not_found', total: 4 },
    ])

    expect(breakdown.map(({ status, count, share }) => [status, count, share])).toEqual([
      ['ok', 90, 90],
      ['ambiguous', 6, 6],
      ['not_found', 4, 4],
      ['skipped', 0, 0],
      ['pending', 0, 0],
    ])
  })

  it('divide filmes e séries sem quebrar com o catálogo vazio', () => {
    expect(typeBreakdown([{ type: 'series', total: 3 }, { type: 'movie', total: 1 }]).map(({ count, share }) => [count, share])).toEqual([
      [1, 25],
      [3, 75],
    ])
    expect(typeBreakdown([]).map(({ share }) => share)).toEqual([0, 0])
  })
})
