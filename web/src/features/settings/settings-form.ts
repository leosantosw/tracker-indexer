import { z } from 'zod'

import type { SettingsPatch } from '@/lib/api'
import type { Settings } from '@/lib/schemas'

const required = { error: 'obrigatório' }

export const settingsFormSchema = z.object({
  tmdb: z.object({
    language: z.string().trim().regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'use o código da TMDB, como pt-BR'),
    rps: z.number(required).positive('maior que zero').max(50, 'no máximo 50'),
    staleDays: z.number(required).int('número inteiro').min(1, 'no mínimo 1'),
    minVotes: z.number(required).int('número inteiro').min(0, 'no mínimo 0'),
  }),
  debrid: z.object({ provider: z.string().nullable() }),
  schedule: z.object({
    enabled: z.boolean(),
    mode: z.enum(['daily', 'interval']),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'horário inválido'),
    days: z.array(z.number().int().min(0).max(6)).min(1, 'marque ao menos um dia'),
    everyMinutes: z.number(required).int('número inteiro').min(1, 'no mínimo 1 minuto').max(10080, 'no máximo uma semana'),
  }),
  secrets: z.record(z.string(), z.string()),
})

export type SettingsForm = z.infer<typeof settingsFormSchema>

export const toFormValues = ({ tmdb, debrid, schedule }: Settings): SettingsForm => ({
  tmdb: { ...tmdb },
  debrid: { provider: debrid.provider },
  schedule: { ...schedule, days: [...schedule.days] },
  secrets: {},
})

export function toPatch({ tmdb, debrid, schedule, secrets }: SettingsForm): SettingsPatch {
  const typed = Object.fromEntries(Object.entries(secrets).filter(([, value]) => value))
  return { tmdb, debrid, schedule, ...(Object.keys(typed).length > 0 && { secrets: typed }) }
}
