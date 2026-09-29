import type { LogEntry, LogLevel } from '@/lib/schemas'

export const LOG_VIEWS = {
  normal: { label: 'Normal', levels: ['info', 'warn', 'error'] },
  detailed: { label: 'Detalhado', levels: ['debug', 'info', 'warn', 'error'] },
  problems: { label: 'Problemas', levels: ['warn', 'error'] },
} satisfies Record<string, { label: string; levels: LogLevel[] }>

export type LogView = keyof typeof LOG_VIEWS

export const isLogView = (value: string | null): value is LogView => value !== null && value in LOG_VIEWS

export const visibleLines = (lines: LogEntry[], view: LogView) =>
  lines.filter((line) => (LOG_VIEWS[view].levels as LogLevel[]).includes(line.level))
