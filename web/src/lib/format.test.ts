import { describe, expect, it } from 'vitest'

import { countdown, duration, elapsed, formatShare, percent, plural, when } from '@/lib/format'

describe('format', () => {
  it('conta regressivamente em horas, e em dias depois de 24h', () => {
    expect(countdown(0)).toBe('agora')
    expect(countdown((2 * 3600 + 14 * 60 + 33) * 1000)).toBe('02:14:33')
    expect(countdown((26 * 3600 + 5) * 1000)).toBe('1d 02:00:05')
  })

  it('mostra o tempo decorrido em mm:ss', () => {
    const start = '2026-09-28T10:00:00.000Z'
    expect(elapsed(start, new Date('2026-09-28T10:03:07.000Z').getTime())).toBe('03:07')
  })

  it('mostra a duração em segundos ou minutos', () => {
    expect(duration('2026-09-28T10:00:00Z', '2026-09-28T10:00:42Z')).toBe('42s')
    expect(duration('2026-09-28T10:00:00Z', '2026-09-28T10:02:05Z')).toBe('2m05s')
  })

  it('flexiona o plural pelo número', () => {
    expect(plural(1, 'linha', 'linhas')).toBe('1 linha')
    expect(plural(1500, 'linha', 'linhas')).toBe('1.500 linhas')
  })

  it('diz hoje e amanhã pelo relógio local', () => {
    const now = new Date(2026, 8, 28, 20, 0)
    expect(when(new Date(2026, 8, 28, 23, 0).toISOString(), now)).toBe('hoje às 23:00')
    expect(when(new Date(2026, 8, 29, 8, 30).toISOString(), now)).toBe('amanhã às 08:30')
    expect(when(new Date(2026, 9, 5, 9, 0).toISOString(), now)).toBe('seg, 05/10 às 09:00')
  })

  it('escreve a porcentagem com uma casa decimal e vírgula', () => {
    expect(formatShare(95.88)).toBe('95,9%')
    expect(formatShare(100)).toBe('100%')
  })

  it('calcula a porcentagem sem dividir por zero', () => {
    expect(percent(1, 4)).toBe(25)
    expect(percent(3, 0)).toBe(0)
  })
})
