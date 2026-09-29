import { afterEach, describe, expect, it, vi } from 'vitest'

import { hideSplash } from '@/lib/splash'

describe('abertura do painel', () => {
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('some com fade e depois sai da página', () => {
    vi.useFakeTimers()
    document.body.innerHTML = '<div id="splash"></div>'

    hideSplash()
    vi.advanceTimersByTime(700)
    expect(document.getElementById('splash')?.dataset.state).toBe('leaving')

    vi.runAllTimers()
    expect(document.getElementById('splash')).toBeNull()
  })

  it('chamar de novo, ou sem abertura na página, não quebra', () => {
    expect(() => {
      hideSplash()
      hideSplash()
    }).not.toThrow()
  })
})
