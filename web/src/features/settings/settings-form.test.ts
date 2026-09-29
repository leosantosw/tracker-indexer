import { describe, expect, it } from 'vitest'

import { settingsFormSchema, toFormValues, toPatch } from '@/features/settings/settings-form'
import type { Settings } from '@/lib/schemas'

const settings: Settings = {
  tmdb: { language: 'pt-BR', rps: 4, staleDays: 30, minVotes: 50 },
  sources: [],
  debrid: { provider: 'torbox', providers: [{ id: 'torbox', label: 'TorBox', secret: 'torboxToken' }] },
  schedule: { enabled: true, mode: 'daily', time: '03:00', days: [1, 3], everyMinutes: 360 },
  secrets: { encryption: true, statuses: { tmdbApiKey: { source: 'env' } } },
}

describe('formulário de configurações', () => {
  it('só manda os segredos que foram digitados', () => {
    const values = { ...toFormValues(settings), secrets: { tmdbApiKey: '', apiToken: 'novo-token' } }

    expect(toPatch(values).secrets).toEqual({ apiToken: 'novo-token' })
    expect(toPatch(toFormValues(settings))).not.toHaveProperty('secrets')
  })

  it('recusa idioma fora do padrão, intervalo vazio e agenda sem dias', () => {
    const values = toFormValues(settings)
    const result = settingsFormSchema.safeParse({
      ...values,
      tmdb: { ...values.tmdb, language: 'portugues' },
      schedule: { ...values.schedule, days: [], everyMinutes: null },
    })

    const messages = Object.fromEntries(result.error?.issues.map((issue) => [issue.path.join('.'), issue.message]) ?? [])
    expect(messages).toEqual({
      'tmdb.language': 'use o código da TMDB, como pt-BR',
      'schedule.days': 'marque ao menos um dia',
      'schedule.everyMinutes': 'obrigatório',
    })
  })
})
