import { describe, expect, it } from 'vitest'

import { toAddPatch, toFormValues, toPatch, trackerFormFor } from '@/features/trackers/tracker-form'
import type { Source } from '@/lib/schemas'

const bySearch: Source = {
  name: 'torrents-csv',
  enabled: true,
  mode: 'terms',
  content: 'both',
  rps: 1,
  pages: 3,
  stopAfterQuietPages: null,
  terms: ['dublado', 'dual'],
  rules: { requireYear: true, dedupe: 'seeders' },
}

const byPages: Source = { ...bySearch, name: 'comando', mode: 'pages', terms: null, rules: { requireYear: false, dedupe: null } }

describe('formulário do tracker', () => {
  it('devolve as regras no formato da API', () => {
    const values = { ...toFormValues(bySearch), dedupeBySeeders: false }

    expect(toPatch(values)).toEqual({
      content: 'both',
      rps: 1,
      pages: 3,
      stopAfterQuietPages: null,
      rules: { requireYear: true, dedupe: null },
      terms: ['dublado', 'dual'],
    })
  })

  it('adicionar um tracker liga ele junto com a configuração', () => {
    expect(toAddPatch(toFormValues({ ...byPages, enabled: false }))).toMatchObject({ enabled: true, content: 'both', rps: 1 })
  })

  it('tracker por catálogo não manda termos', () => {
    expect(toPatch(toFormValues(byPages))).not.toHaveProperty('terms')
  })

  it('tracker por busca exige ao menos um termo', () => {
    const result = trackerFormFor(bySearch).safeParse({ ...toFormValues(bySearch), terms: [] })

    expect(result.error?.issues.map((issue) => issue.message)).toEqual(['informe ao menos um termo'])
  })
})
