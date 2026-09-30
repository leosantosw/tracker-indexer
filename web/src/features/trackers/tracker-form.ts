import { z } from 'zod'

import type { SettingsPatch, SourcePatch } from '@/lib/api'
import { contentSchema, resolutionSchema, type Resolution, type SizeLimits, type Source } from '@/lib/schemas'

const optionalCount = z.number().int('número inteiro').min(1, 'no mínimo 1').nullable()

const optionalGigabytes = z.number().positive('maior que zero').max(1000, 'no máximo 1000').nullable()

export const ACCOUNT_FIELDS = ['username', 'password'] as const

export type AccountField = (typeof ACCOUNT_FIELDS)[number]

export const trackerFormSchema = z.object({
  content: contentSchema,
  resolutions: z.array(resolutionSchema).min(1, 'marque ao menos uma resolução'),
  maxMovieGb: optionalGigabytes,
  maxEpisodeGb: optionalGigabytes,
  maxSeasonGb: optionalGigabytes,
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

const ALL_RESOLUTIONS = resolutionSchema.options

const selectedResolutions = (resolutions: Resolution[]) => (resolutions.length === ALL_RESOLUTIONS.length ? null : resolutions)

const NO_SIZE_LIMITS: SizeLimits = { movie: null, episode: null, season: null }

const sizeLimitsOf = ({ maxMovieGb, maxEpisodeGb, maxSeasonGb }: TrackerForm): SizeLimits | null =>
  maxMovieGb === null && maxEpisodeGb === null && maxSeasonGb === null ? null : { movie: maxMovieGb, episode: maxEpisodeGb, season: maxSeasonGb }

export const toFormValues = (source: Source): TrackerForm => ({
  content: source.content,
  resolutions: source.resolutions ?? [...ALL_RESOLUTIONS],
  maxMovieGb: (source.maxSizeGb ?? NO_SIZE_LIMITS).movie,
  maxEpisodeGb: (source.maxSizeGb ?? NO_SIZE_LIMITS).episode,
  maxSeasonGb: (source.maxSizeGb ?? NO_SIZE_LIMITS).season,
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

export const toPatch = (form: TrackerForm): SourcePatch => {
  const { requireYear, dedupeBySeeders, terms, freeleechOnly, resolutions, maxMovieGb, maxEpisodeGb, maxSeasonGb, username, password, ...values } = form
  return {
    ...values,
    resolutions: selectedResolutions(resolutions),
    maxSizeGb: sizeLimitsOf(form),
    rules: { requireYear, dedupe: dedupeBySeeders ? 'seeders' : null },
    ...(terms && { terms }),
    ...(freeleechOnly !== null && { freeleechOnly }),
  }
}

export const toAddPatch = (values: TrackerForm): SourcePatch => ({ ...toPatch(values), enabled: true })

export function toSettingsPatch(name: string, values: TrackerForm, adding: boolean): SettingsPatch {
  const typed = ACCOUNT_FIELDS.filter((field) => values[field]).map((field) => [accountSecret(name, field), values[field] as string])
  return {
    sources: { [name]: adding ? toAddPatch(values) : toPatch(values) },
    ...(typed.length > 0 && { secrets: Object.fromEntries(typed) }),
  }
}
