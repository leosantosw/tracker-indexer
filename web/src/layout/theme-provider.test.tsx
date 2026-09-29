import { render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { AppThemeProvider } from '@/layout/theme-provider'

describe('tema do painel', () => {
  afterEach(() => {
    localStorage.clear()
    document.documentElement.className = ''
  })

  it('abre no escuro quando ninguém escolheu um tema', () => {
    render(<AppThemeProvider>painel</AppThemeProvider>)

    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('respeita o tema que a pessoa já escolheu', () => {
    localStorage.setItem('theme', 'light')

    render(<AppThemeProvider>painel</AppThemeProvider>)

    expect(document.documentElement.classList.contains('light')).toBe(true)
  })
})
