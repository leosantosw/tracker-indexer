import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import { LogPanel } from '@/features/activity/log-panel'
import { useLogStore } from '@/lib/log-store'

const at = '2026-09-29T01:02:03Z'

describe('LogPanel', () => {
  afterEach(() => {
    useLogStore.getState().clear()
    localStorage.clear()
  })

  it('mostra origem e nível e filtra por problemas', async () => {
    const user = userEvent.setup()
    useLogStore.setState({
      lines: [
        { at, level: 'debug', scope: 'torrents-csv', message: 'termo "dual": 3 páginas' },
        { at, level: 'info', scope: 'comando', message: '2 páginas · nenhum novo' },
        { at, level: 'warn', scope: 'redes-torrents', message: 'página 3 sem nenhum magnet' },
      ],
    })
    render(<LogPanel />)

    expect(screen.queryByText('termo "dual": 3 páginas')).toBeNull()
    expect(screen.getByText('comando')).toBeTruthy()
    expect(screen.getByText('INFO')).toBeTruthy()

    await user.click(screen.getByRole('radio', { name: 'Problemas' }))

    expect(screen.queryByText('2 páginas · nenhum novo')).toBeNull()
    expect(screen.getByText('página 3 sem nenhum magnet')).toBeTruthy()
    expect(localStorage.getItem('activity:log-view')).toBe('problems')
  })

  it('avisa quando o filtro esconde tudo', async () => {
    const user = userEvent.setup()
    useLogStore.setState({ lines: [{ at, level: 'info', scope: 'comando', message: 'ok' }] })
    render(<LogPanel />)

    await user.click(screen.getByRole('radio', { name: 'Problemas' }))

    expect(screen.getByText('Nenhuma linha com esse filtro.')).toBeTruthy()
  })
})
