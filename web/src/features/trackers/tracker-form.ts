import { z } from 'zod'

import type { SettingsPatch, SourcePatch } from '@/lib/api'
import { contentSchema, type Source } from '@/lib/schemas'

const optionalCount = z.number().int('número inteiro').min(1, 'no mínimo 1').nullable()

export const ACCOUNT_FIELDS = ['username', 'password'] as const

export type AccountField = (typeof ACCOUNT_FIELDS)[number]

export const trackerFormSchema = z.object({
  content: contentSchema,
  rps: z.number({ error: 'obrigatório' }).positive('maior que zero').max(50, 'no máximo 50'),
  pages: optionalCount,
  stopAfterQuietPages: optionalCount,
  requireYear: z.boolean(),
  dedupeBySeeders: z.boolean(),
  freeleechOnly: z.boolean().nullable(),
  terms: z.array(z.string().min(3, 'mínimo de 3 caracteres')).nullable(),
  username: z.string().max(256, 'no máximo 256 caracteres').optional(),
  password: z.string().max(256, 'no máximo 256 caracteres').optional(),
})

export type TrackerForm = z.infer<typeof trackerFormSchema>

export const accountSecret = (name: string, field: AccountField) => `${name}:${field}`

type SavedAccount = Record<AccountField, boolean>

const ALL_SAVED: SavedAccount = { username: true, password: true }

export const trackerFormFor = (source: Source, saved: SavedAccount = ALL_SAVED) =>
  trackerFormSchema.superRefine((values, ctx) => {
    if (source.mode === 'terms' && !values.terms?.length) {
      ctx.addIssue({ code: 'custom', path: ['terms'], message: 'informe ao menos um termo' })
    }
    if (!source.requiresLogin) return
    for (const field of ACCOUNT_FIELDS) {
      if (!saved[field] && !values[field]) ctx.addIssue({ code: 'custom', path: [field], message: 'obrigatório' })
    }
  })

export const toFormValues = (source: Source): TrackerForm => ({
  content: source.content,
  rps: source.rps,
  pages: source.pages,
  stopAfterQuietPages: source.stopAfterQuietPages,
  requireYear: source.rules.requireYear,
  dedupeBySeeders: source.rules.dedupe === 'seeders',
  freeleechOnly: source.freeleechOnly ?? null,
  terms: source.mode === 'terms' ? [...(source.terms ?? [])] : null,
  username: '',
  password: '',
})

export const toPatch = ({ requireYear, dedupeBySeeders, terms, freeleechOnly, username, password, ...values }: TrackerForm): SourcePatch => ({
  ...values,
  rules: { requireYear, dedupe: dedupeBySeeders ? 'seeders' : null },
  ...(terms && { terms }),
  ...(freeleechOnly !== null && { freeleechOnly }),
})

export const toAddPatch = (values: TrackerForm): SourcePatch => ({ ...toPatch(values), enabled: true })

export function toSettingsPatch(name: string, values: TrackerForm, adding: boolean): SettingsPatch {
  const typed = ACCOUNT_FIELDS.filter((field) => values[field]).map((field) => [accountSecret(name, field), values[field] as string])
  return {
    sources: { [name]: adding ? toAddPatch(values) : toPatch(values) },
    ...(typed.length > 0 && { secrets: Object.fromEntries(typed) }),
  }
}
