import { describe, expect, it } from 'vitest'

import { addedTrackers, availableTrackers } from '@/features/trackers/tracker-lists'
import type { Source } from '@/lib/schemas'

const tracker = (name: string, enabled: boolean): Source => ({
  name,
  site: `https://${name}.com`,
  enabled,
  mode: 'pages',
  content: 'both',
  rps: 1,
  pages: null,
  stopAfterQuietPages: null,
  terms: null,
  rules: { requireYear: true, dedupe: null },
})

const sources = [tracker('comando', true), tracker('bludv', false), tracker('redes-torrents', true)]

describe('trackers adicionados e disponíveis', () => {
  it('a lista do painel mostra só os adicionados, na ordem do registro', () => {
    expect(addedTrackers(sources).map((source) => source.name)).toEqual(['comando', 'redes-torrents'])
  })

  it('o dialog de adicionar oferece só os que faltam', () => {
    expect(availableTrackers(sources).map((source) => source.name)).toEqual(['bludv'])
  })
})
