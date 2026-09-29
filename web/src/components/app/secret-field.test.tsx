import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { SecretField, type SecretMeta } from '@/components/app/secret-field'

const meta = (over: Partial<SecretMeta> = {}): SecretMeta => ({
  label: 'Campo',
  hint: 'dica',
  missing: { label: 'ausente', variant: 'warning' },
  ...over,
})

function Harness({ over }: { over?: Partial<SecretMeta> }) {
  const [value, setValue] = useState('')
  return (
    <>
      <SecretField meta={meta(over)} status={{ source: null }} encryption value={value} onChange={setValue} onRemove={() => {}} />
      <output>{`[${value}]`}</output>
    </>
  )
}

describe('SecretField', () => {
  it('esconde o valor digitado por padrão', () => {
    render(<Harness />)

    expect(screen.getByPlaceholderText('novo valor').getAttribute('type')).toBe('password')
  })

  it('campo visível, como o usuário do tracker, mostra o que é digitado', () => {
    render(<Harness over={{ visible: true }} />)

    expect(screen.getByPlaceholderText('novo valor').getAttribute('type')).toBe('text')
  })

  it('só mantém os espaços das pontas quando o campo pede', async () => {
    const user = userEvent.setup()
    render(<Harness over={{ keepSpaces: true }} />)

    await user.type(screen.getByPlaceholderText('novo valor'), ' com espaço ')

    expect(screen.getByRole('status').textContent).toBe('[ com espaço ]')
  })
})
