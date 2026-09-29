import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { IdleDetails, IdleSummary } from '@/features/activity/idle-view'
import type { LastJob } from '@/lib/schemas'

const last: LastJob = {
  job: 'sync',
  result: 'failed',
  reason: null,
  error: 'comando fora do ar',
  startedAt: '2026-09-29T10:00:00Z',
  finishedAt: '2026-09-29T10:01:05Z',
  progress: null,
}

describe('atividade parada', () => {
  it('resume a última execução numa linha', () => {
    render(<IdleSummary last={last} />)

    expect(screen.getByText('Atualização do catálogo')).toBeTruthy()
    expect(screen.getByText('falhou')).toBeTruthy()
    expect(screen.getByText(/levou 1m05s/)).toBeTruthy()
  })

  it('sem execução, diz que está ociosa', () => {
    render(<IdleSummary last={null} />)

    expect(screen.getByText('Ociosa')).toBeTruthy()
  })

  it('mostra o erro abaixo da linha, e nada quando não houve problema', () => {
    const { rerender, container } = render(<IdleDetails last={last} />)
    expect(screen.getByText('comando fora do ar')).toBeTruthy()

    rerender(<IdleDetails last={{ ...last, result: 'done', error: null }} />)
    expect(container.innerHTML).toBe('')
  })
})
