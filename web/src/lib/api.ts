import type { z } from 'zod'

import {
  checkResultSchema,
  clearUnmatchedResultSchema,
  jobStatusSchema,
  logEntrySchema,
  scheduleStatusSchema,
  settingsSchema,
  statusSchema,
  tmdbCandidateSchema,
  unmatchedPageSchema,
  type JobName,
  type JobStatus,
  type LogEntry,
  type ScheduleStatus,
  type UnmatchedStatus,
  type WorkType,
} from '@/lib/schemas'
import { adminToken } from '@/lib/token'

const BASE = '/api/admin'

export class AuthError extends Error {
  tokenRequired: boolean

  constructor(message: string, tokenRequired: boolean) {
    super(message)
    this.tokenRequired = tokenRequired
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

async function request(method: Method, path: string, body?: unknown): Promise<unknown> {
  const headers: Record<string, string> = {}
  const token = adminToken.get()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))

  if (res.status === 401) throw new AuthError(data.error ?? 'acesso negado', Boolean(data.tokenRequired))
  if (!res.ok) throw new Error(data.message ?? data.error ?? `HTTP ${res.status}`)
  return data
}

const parsed =
  <T extends z.ZodType>(schema: T) =>
  async (promise: Promise<unknown>): Promise<z.infer<T>> =>
    schema.parse(await promise)

const query = (params: Record<string, string | number | null | undefined>) => {
  const entries = Object.entries(params).filter(([, value]) => value !== null && value !== undefined)
  return new URLSearchParams(entries.map(([key, value]) => [key, String(value)])).toString()
}

export type SettingsPatch = Partial<{
  tmdb: { language: string; rps: number; staleDays: number; minVotes: number }
  debrid: { provider: string | null }
  schedule: { enabled: boolean; mode: 'daily' | 'interval'; time: string; days: number[]; everyMinutes: number }
  sources: Record<string, SourcePatch>
  secrets: Record<string, string | null>
}>

export type SourcePatch = Partial<{
  enabled: boolean
  content: string
  rps: number
  pages: number | null
  stopAfterQuietPages: number | null
  terms: string[]
  freeleechOnly: boolean
  rules: { requireYear?: boolean; dedupe?: 'seeders' | null }
}>

export type UnmatchedQuery = { page: number; limit: number; source?: string | null; status?: UnmatchedStatus | null }

export const api = {
  status: () => parsed(statusSchema)(request('GET', '/status')),
  settings: () => parsed(settingsSchema)(request('GET', '/settings')),
  saveSettings: (patch: SettingsPatch) => parsed(settingsSchema)(request('PUT', '/settings', patch)),
  resetSettings: () => parsed(settingsSchema)(request('DELETE', '/settings')),
  startJob: (job: JobName, options: { sources?: string[] } = {}) =>
    parsed(jobStatusSchema)(request('POST', `/jobs/${job}`, options)),
  cancelJob: () => parsed(jobStatusSchema)(request('DELETE', '/jobs/current')),
  clearSource: (name: string) =>
    request('DELETE', `/sources/${encodeURIComponent(name)}/items`) as Promise<{ source: string; removed: number }>,
  checkSource: (name: string) => parsed(checkResultSchema)(request('POST', `/sources/${encodeURIComponent(name)}/check`)),
  unmatched: (params: UnmatchedQuery) => parsed(unmatchedPageSchema)(request('GET', `/unmatched?${query(params)}`)),
  clearUnmatched: (filters: Pick<UnmatchedQuery, 'source' | 'status'>) =>
    parsed(clearUnmatchedResultSchema)(request('DELETE', `/unmatched?${query(filters)}`)),
  tmdbSearch: async (type: WorkType, text: string) => {
    const { results } = (await request('GET', `/tmdb/search?${query({ type, query: text })}`)) as { results: unknown[] }
    return results.map((result) => tmdbCandidateSchema.parse(result))
  },
  manualMatch: (id: number, tmdbId: number) => request('POST', `/works/${id}/match`, { tmdbId }),
  setupStatus: () => request('GET', '/setup') as Promise<{ required: boolean }>,
  createAdminToken: (token: string) => request('POST', '/setup', { token }),
}

type EventHandlers = {
  onOpen: () => void
  onError: () => void
  onStatus: (job: JobStatus) => void
  onSchedule: (schedule: ScheduleStatus) => void
  onLog: (entry: LogEntry) => void
}

export function openEvents({ onOpen, onError, onStatus, onSchedule, onLog }: EventHandlers) {
  const token = adminToken.get()
  const events = new EventSource(`${BASE}/events${token ? `?${query({ token })}` : ''}`)
  const listen = <T extends z.ZodType>(type: string, schema: T, handler: (value: z.infer<T>) => void) =>
    events.addEventListener(type, (event) => handler(schema.parse(JSON.parse((event as MessageEvent).data))))

  events.addEventListener('open', onOpen)
  events.addEventListener('error', onError)
  listen('status', jobStatusSchema, onStatus)
  listen('schedule', scheduleStatusSchema, onSchedule)
  listen('log', logEntrySchema, onLog)
  return events
}
