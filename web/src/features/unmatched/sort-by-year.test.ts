import { describe, expect, it } from 'vitest'

import { sortByYear } from '@/features/unmatched/sort-by-year'

const candidate = (tmdbId: number, year: number | null) => ({ tmdbId, title: `Obra ${tmdbId}`, year })

describe('sortByYear', () => {
  it('sobe quem bate com o ano (±1) e mantém a ordem da TMDB no resto', () => {
    const sorted = sortByYear([candidate(1, 1990), candidate(2, 2014), candidate(3, null), candidate(4, 2013)], 2014)

    expect(sorted.map(({ candidate: item, fits }) => [item.tmdbId, fits])).toEqual([
      [2, true],
      [4, true],
      [1, false],
      [3, false],
    ])
  })

  it('sem ano, não reordena', () => {
    const sorted = sortByYear([candidate(1, 1990), candidate(2, 2014)], null)

    expect(sorted.map(({ candidate: item }) => item.tmdbId)).toEqual([1, 2])
  })
})
