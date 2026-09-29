import { z } from 'zod'

import type { SourcePatch } from '@/lib/api'
import { contentSchema, type Source } from '@/lib/schemas'

const optionalCount = z.number().int('número inteiro').min(1, 'no mínimo 1').nullable()

export const trackerFormSchema = z.object({
  enabled: z.boolean(),
  content: contentSchema,
  rps: z.number({ error: 'obrigatório' }).positive('maior que zero').max(50, 'no máximo 50'),
  pages: optionalCount,
  stopAfterQuietPages: optionalCount,
  requireYear: z.boolean(),
  dedupeBySeeders: z.boolean(),
  terms: z.array(z.string().min(3, 'mínimo de 3 caracteres')).nullable(),
})

export type TrackerForm = z.infer<typeof trackerFormSchema>

export const trackerFormFor = (source: Source) =>
  source.mode === 'terms'
    ? trackerFormSchema.refine((values) => Boolean(values.terms?.length), { path: ['terms'], message: 'informe ao menos um termo' })
    : trackerFormSchema

export const toFormValues = (source: Source): TrackerForm => ({
  enabled: source.enabled,
  content: source.content,
  rps: source.rps,
  pages: source.pages,
  stopAfterQuietPages: source.stopAfterQuietPages,
  requireYear: source.rules.requireYear,
  dedupeBySeeders: source.rules.dedupe === 'seeders',
  terms: source.mode === 'terms' ? [...(source.terms ?? [])] : null,
})

export const toPatch = ({ requireYear, dedupeBySeeders, terms, ...values }: TrackerForm): SourcePatch => ({
  ...values,
  rules: { requireYear, dedupe: dedupeBySeeders ? 'seeders' : null },
  ...(terms && { terms }),
})
