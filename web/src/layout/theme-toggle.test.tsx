import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'next-themes'
import { describe, expect, it } from 'vitest'

import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeToggle } from '@/layout/theme-toggle'

describe('ThemeToggle', () => {
  it('escolher Escuro liga o tema escuro e guarda a escolha', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <TooltipProvider>
          <ThemeToggle />
        </TooltipProvider>
      </ThemeProvider>
    )

    await user.click(screen.getByRole('button', { name: 'Tema' }))
    await user.click(await screen.findByRole('menuitemradio', { name: 'Escuro' }))

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('theme')).toBe('dark')
  })
})
