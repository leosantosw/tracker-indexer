import { describe, expect, it } from 'vitest'

import { isLogView, visibleLines } from '@/features/activity/log-filter'
import type { LogEntry, LogLevel } from '@/lib/schemas'

const line = (level: LogLevel): LogEntry => ({ at: '2026-09-29T01:02:03Z', level, scope: 'comando', message: level })
const lines = [line('debug'), line('info'), line('warn'), line('error')]
const levels = (entries: LogEntry[]) => entries.map((entry) => entry.level)

describe('filtro do log', () => {
  it('normal esconde só o debug', () => {
    expect(levels(visibleLines(lines, 'normal'))).toEqual(['info', 'warn', 'error'])
  })

  it('detalhado mostra tudo e problemas só avisos e erros', () => {
    expect(levels(visibleLines(lines, 'detailed'))).toEqual(['debug', 'info', 'warn', 'error'])
    expect(levels(visibleLines(lines, 'problems'))).toEqual(['warn', 'error'])
  })

  it('só aceita visões conhecidas vindas do armazenamento', () => {
    expect(isLogView('problems')).toBe(true)
    expect(isLogView('tudo')).toBe(false)
    expect(isLogView(null)).toBe(false)
  })
})
