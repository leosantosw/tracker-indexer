import { describe, expect, it } from 'vitest'

import { pagesFieldText } from '@/features/trackers/scan-text'
import type { Source } from '@/lib/schemas'

const byPages: Source = {
  name: 'comando',
  site: 'https://comando.la',
  access: 'public',
  enabled: true,
  mode: 'pages',
  content: 'both',
  rps: 1,
  pages: 10,
  stopAfterQuietPages: null,
  terms: null,
  rules: { requireYear: false, dedupe: null },
}

const byCategory: Source = {
  ...byPages,
  name: 'amigos-share-club',
  pages: 3,
  categories: { movies: ['filmes', 'anime-filmes'], series: ['series', 'anime-series'], both: ['filmes', 'anime-filmes', 'series', 'anime-series'] },
}

describe('texto do campo de páginas', () => {
  it('tracker com categorias conta as páginas de todas elas', () => {
    expect(pagesFieldText(byCategory, 'both', 3)).toEqual({
      label: 'Páginas por categoria',
      description: '4 categorias: até 12 páginas por execução.',
    })
  })

  it('o total acompanha o conteúdo escolhido', () => {
    expect(pagesFieldText(byCategory, 'movies', 3).description).toBe('2 categorias: até 6 páginas por execução.')
  })

  it('sem limite, cada categoria vai até o fim', () => {
    expect(pagesFieldText(byCategory, 'both', null).description).toBe('4 categorias, cada uma até a última página.')
  })

  it('tracker sem categorias continua por varredura ou por termo', () => {
    expect(pagesFieldText(byPages, 'both', 10).label).toBe('Páginas por varredura')
    expect(pagesFieldText({ ...byPages, mode: 'terms' }, 'both', 10).label).toBe('Páginas por termo')
  })
})
