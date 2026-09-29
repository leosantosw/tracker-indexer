import { z } from 'zod'

export const jobNameSchema = z.enum(['sync', 'enrich', 'cache'])
export const contentSchema = z.enum(['movies', 'series', 'both'])
export const workTypeSchema = z.enum(['movie', 'series'])
export const matchStatusSchema = z.enum(['ok', 'ambiguous', 'not_found', 'skipped', 'pending'])
export const stepStateSchema = z.enum(['pending', 'running', 'done', 'skipped', 'failed'])
export const jobResultSchema = z.enum(['done', 'skipped', 'cancelled', 'failed'])

const sourceProgressSchema = z.object({
  name: z.string(),
  state: stepStateSchema,
  pages: z.number(),
  maxPages: z.number().nullable(),
  terms: z.number().nullable(),
  termIndex: z.number().nullable(),
  byCategory: z.boolean().optional(),
  inserted: z.number(),
  removed: z.number(),
})

const tmdbProgressSchema = z.object({
  state: stepStateSchema,
  total: z.number(),
  done: z.number(),
  ok: z.number(),
  notFound: z.number(),
  ambiguous: z.number(),
  skipped: z.number(),
  failed: z.number(),
  startedAt: z.string().nullable(),
  reason: z.string().nullable(),
})

const cacheProgressSchema = z.object({
  state: stepStateSchema,
  total: z.number(),
  done: z.number(),
  cached: z.number(),
  reason: z.string().nullable(),
})

const progressSchema = z.object({
  phase: z.enum(['sources', 'tmdb', 'cache', 'done']),
  sources: z.array(sourceProgressSchema),
  tmdb: tmdbProgressSchema.nullable(),
  cache: cacheProgressSchema.nullish(),
  warnings: z.array(z.object({ source: z.string().nullable(), text: z.string() })),
})

export const jobStatusSchema = z.object({
  running: z
    .object({
      job: jobNameSchema,
      startedAt: z.string(),
      cancelling: z.boolean(),
      progress: progressSchema.nullish(),
    })
    .nullable(),
  last: z
    .object({
      job: jobNameSchema,
      result: jobResultSchema,
      reason: z.string().nullable(),
      error: z.string().nullable(),
      startedAt: z.string(),
      finishedAt: z.string(),
      progress: progressSchema.nullish(),
    })
    .nullable(),
})

export const scheduleStatusSchema = z.object({
  enabled: z.boolean(),
  description: z.string(),
  nextRunAt: z.string().nullable(),
})

export const statusSchema = z.object({
  job: jobStatusSchema,
  schedule: scheduleStatusSchema,
  stats: z.object({
    sources: z.array(z.object({ source: z.string(), total: z.number() })),
    works: z.array(z.object({ status: matchStatusSchema, total: z.number() })),
    types: z.array(z.object({ type: workTypeSchema, total: z.number() })),
    cache: z.array(z.object({ source: z.string(), total: z.number(), checked: z.number(), cached: z.number() })).default([]),
  }),
})

export const sourceSchema = z.object({
  name: z.string(),
  site: z.url(),
  access: z.enum(['public', 'private']),
  requiresLogin: z.boolean().optional(),
  enabled: z.boolean(),
  mode: z.enum(['terms', 'pages']),
  content: contentSchema,
  categories: z.partialRecord(contentSchema, z.array(z.string())).nullish(),
  rps: z.number(),
  pages: z.number().nullable(),
  stopAfterQuietPages: z.number().nullable(),
  terms: z.array(z.string()).nullish(),
  freeleechOnly: z.boolean().optional(),
  rules: z.object({ requireYear: z.boolean(), dedupe: z.enum(['seeders']).nullable() }),
})

export const scheduleSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(['daily', 'interval']),
  time: z.string(),
  days: z.array(z.number()),
  everyMinutes: z.number(),
})

const secretStatusSchema = z.object({
  source: z.enum(['panel', 'env']).nullable(),
  error: z.string().nullish(),
})

export type SecretStatus = z.infer<typeof secretStatusSchema>

export const settingsSchema = z.object({
  tmdb: z.object({ language: z.string(), rps: z.number(), staleDays: z.number(), minVotes: z.number() }),
  sources: z.array(sourceSchema),
  debrid: z.object({
    provider: z.string().nullable(),
    checkCache: z.boolean().default(false),
    providers: z.array(z.object({ id: z.string(), label: z.string(), secret: z.string(), cacheBatch: z.number().nullish() })),
  }),
  schedule: scheduleSchema,
  secrets: z
    .object({ encryption: z.boolean() })
    .catchall(secretStatusSchema)
    .transform(({ encryption, ...statuses }) => ({ encryption: Boolean(encryption), statuses: statuses as Record<string, SecretStatus> })),
})

export const checkStatusSchema = z.enum(['ok', 'filtered', 'rejected', 'no-year', 'no-magnet'])

export const checkResultSchema = z.object({
  source: z.string(),
  entries: z.array(z.object({ status: checkStatusSchema, detail: z.string().nullish() })),
  totals: z.partialRecord(checkStatusSchema, z.number()),
})

export const unmatchedStatusSchema = z.enum(['not_found', 'ambiguous'])

export const unmatchedWorkSchema = z.object({
  id: z.number(),
  type: workTypeSchema,
  title: z.string(),
  year: z.number().nullable(),
  status: unmatchedStatusSchema,
  torrents: z.number(),
  checkedAt: z.number(),
  names: z.array(z.object({ source: z.string(), rawName: z.string() })),
})

export const unmatchedPageSchema = z.object({
  works: z.array(unmatchedWorkSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  counts: z.object({
    byStatus: z.array(z.object({ status: unmatchedStatusSchema, total: z.number() })),
    bySource: z.array(z.object({ source: z.string(), total: z.number() })),
  }),
})

export const clearUnmatchedResultSchema = z.object({ works: z.number(), removed: z.number() })

export const tmdbCandidateSchema = z.object({
  tmdbId: z.number(),
  title: z.string(),
  originalTitle: z.string().nullish(),
  year: z.number().nullish(),
  overview: z.string().nullish(),
  poster: z.string().nullish(),
})

export const logLevelSchema = z.enum(['debug', 'info', 'warn', 'error'])

export const logEntrySchema = z.object({ at: z.string(), level: logLevelSchema, scope: z.string(), message: z.string() })

export type JobName = z.infer<typeof jobNameSchema>
export type Content = z.infer<typeof contentSchema>
export type WorkType = z.infer<typeof workTypeSchema>
export type MatchStatus = z.infer<typeof matchStatusSchema>
export type StepState = z.infer<typeof stepStateSchema>
export type JobResult = z.infer<typeof jobResultSchema>
export type JobStatus = z.infer<typeof jobStatusSchema>
export type RunningJob = NonNullable<JobStatus['running']>
export type LastJob = NonNullable<JobStatus['last']>
export type Progress = z.infer<typeof progressSchema>
export type SourceProgress = z.infer<typeof sourceProgressSchema>
export type TmdbProgress = z.infer<typeof tmdbProgressSchema>
export type CacheProgress = z.infer<typeof cacheProgressSchema>
export type ScheduleStatus = z.infer<typeof scheduleStatusSchema>
export type Status = z.infer<typeof statusSchema>
export type Source = z.infer<typeof sourceSchema>
export type Schedule = z.infer<typeof scheduleSchema>
export type Settings = z.infer<typeof settingsSchema>
export type CheckStatus = z.infer<typeof checkStatusSchema>
export type CheckResult = z.infer<typeof checkResultSchema>
export type UnmatchedStatus = z.infer<typeof unmatchedStatusSchema>
export type UnmatchedWork = z.infer<typeof unmatchedWorkSchema>
export type UnmatchedPage = z.infer<typeof unmatchedPageSchema>
export type TmdbCandidate = z.infer<typeof tmdbCandidateSchema>
export type LogLevel = z.infer<typeof logLevelSchema>
export type LogEntry = z.infer<typeof logEntrySchema>
