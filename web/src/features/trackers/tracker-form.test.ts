import { describe, expect, it } from 'vitest'

import { toAddPatch, toFormValues, toPatch, toSettingsPatch, trackerFormFor } from '@/features/trackers/tracker-form'
import type { Source } from '@/lib/schemas'

const bySearch: Source = {
  name: 'torrents-csv',
  site: 'https://torrents-csv.com',
  access: 'public',
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

const privateTracker: Source = {
  ...byPages,
  name: 'amigos-share-club',
  site: 'https://amigos-share.club',
  access: 'private',
  requiresLogin: true,
  enabled: false,
  freeleechOnly: true,
}

describe('formulário do tracker', () => {
  it('devolve as regras no formato da API', () => {
    const values = { ...toFormValues(bySearch), dedupeBySeeders: false }

    expect(toPatch(values)).toEqual({
      content: 'both',
      resolutions: null,
      maxSizeGb: null,
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

  it('tracker privado exige usuário e senha que ainda não foram salvos', () => {
    const schema = trackerFormFor(privateTracker, { username: true, password: false })

    const result = schema.safeParse(toFormValues(privateTracker))

    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual(['password'])
    expect(schema.safeParse({ ...toFormValues(privateTracker), password: 'senha' }).success).toBe(true)
  })

  it('usuário e senha vão como segredos, fora do patch do tracker', () => {
    const values = { ...toFormValues(privateTracker), username: 'leo', password: ' com espaço ' }

    const patch = toSettingsPatch(privateTracker.name, values, true)

    expect(patch.secrets).toEqual({ 'amigos-share-club:username': 'leo', 'amigos-share-club:password': ' com espaço ' })
    expect(patch.sources?.['amigos-share-club']).toMatchObject({ enabled: true, freeleechOnly: true })
    expect(JSON.stringify(patch.sources)).not.toContain('leo')
  })

  it('sem nada digitado, não mexe nos segredos', () => {
    expect(toSettingsPatch(privateTracker.name, toFormValues(privateTracker), false)).not.toHaveProperty('secrets')
  })

  it('tracker sem a opção de freeleech não manda o campo', () => {
    expect(toPatch(toFormValues(byPages))).not.toHaveProperty('freeleechOnly')
  })
})

describe('resoluções do tracker', () => {
  it('tracker sem filtro abre com todas as resoluções marcadas e continua sem filtro', () => {
    const values = toFormValues(byPages)

    expect(values.resolutions).toEqual(['2160p', '1080p', '720p', '480p', 'other'])
    expect(toPatch(values).resolutions).toBeNull()
  })

  it('manda só as resoluções marcadas', () => {
    expect(toPatch({ ...toFormValues(byPages), resolutions: ['1080p', '720p'] }).resolutions).toEqual(['1080p', '720p'])
  })

  it('abre com a seleção salva', () => {
    expect(toFormValues({ ...byPages, resolutions: ['1080p'] }).resolutions).toEqual(['1080p'])
  })

  it('exige ao menos uma resolução', () => {
    const result = trackerFormFor(byPages).safeParse({ ...toFormValues(byPages), resolutions: [] })

    expect(result.error?.issues.map((issue) => issue.message)).toEqual(['marque ao menos uma resolução'])
  })
})

describe('tamanho máximo do tracker', () => {
  it('tracker sem limite abre com os campos vazios e continua sem limite', () => {
    const values = toFormValues(byPages)

    expect([values.maxMovieGb, values.maxEpisodeGb, values.maxSeasonGb]).toEqual([null, null, null])
    expect(toPatch(values).maxSizeGb).toBeNull()
  })

  it('manda os limites preenchidos e null nos vazios', () => {
    const values = { ...toFormValues(byPages), maxMovieGb: 20, maxSeasonGb: 60 }

    expect(toPatch(values).maxSizeGb).toEqual({ movie: 20, episode: null, season: 60 })
  })

  it('abre com os limites salvos', () => {
    const values = toFormValues({ ...byPages, maxSizeGb: { movie: 20, episode: 5, season: null } })

    expect([values.maxMovieGb, values.maxEpisodeGb, values.maxSeasonGb]).toEqual([20, 5, null])
  })

  it('recusa limite zero', () => {
    const result = trackerFormFor(byPages).safeParse({ ...toFormValues(byPages), maxEpisodeGb: 0 })

    expect(result.error?.issues.map((issue) => issue.message)).toEqual(['maior que zero'])
  })
})
