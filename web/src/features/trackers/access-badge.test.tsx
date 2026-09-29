import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AccessBadge } from '@/features/trackers/access-badge'

describe('AccessBadge', () => {
  it('mostra público ou privado, com a explicação no título', () => {
    render(
      <>
        <AccessBadge access="public" />
        <AccessBadge access="private" />
      </>
    )

    expect(screen.getByText('público').closest('[title]')?.getAttribute('title')).toMatch(/não pede conta/)
    expect(screen.getByText('privado').closest('[title]')?.getAttribute('title')).toMatch(/pede conta ou convite/)
  })
})
