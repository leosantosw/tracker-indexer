import { describe, expect, it } from 'vitest'

import { cachePercent, cacheRowText } from '@/features/settings/cache-stats'

describe('cache por tracker', () => {
  it('a porcentagem conta só o que já foi verificado', () => {
    expect(cachePercent({ cached: 234, checked: 828 })).toBe(28)
    expect(cachePercent({ cached: 0, checked: 0 })).toBe(0)
  })

  it('diz quanto está em cache e quanto falta verificar', () => {
    expect(cacheRowText({ source: 'asc', total: 900, checked: 828, cached: 234 })).toBe('234 de 828 no cache (28%) · 72 a verificar')
    expect(cacheRowText({ source: 'asc', total: 828, checked: 828, cached: 234 })).toBe('234 de 828 no cache (28%)')
  })

  it('tracker ainda não verificado não finge 0%', () => {
    expect(cacheRowText({ source: 'comando', total: 1478, checked: 0, cached: 0 })).toBe('1.478 torrents · nenhum verificado ainda')
  })
})
