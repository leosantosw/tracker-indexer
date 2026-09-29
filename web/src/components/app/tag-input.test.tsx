import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { TagInput } from '@/components/app/tag-input'

function Harness({ initial = [] as string[] }) {
  const [tags, setTags] = useState(initial)
  return (
    <>
      <TagInput value={tags} onChange={setTags} minLength={3} placeholder="novo termo" />
      <output>{tags.join('|')}</output>
    </>
  )
}

describe('TagInput', () => {
  it('Enter e vírgula adicionam; curto demais e repetido ficam de fora', async () => {
    const user = userEvent.setup()
    render(<Harness initial={['filme']} />)
    const input = screen.getByPlaceholderText('novo termo')

    await user.type(input, 'serie{Enter}ab,dublado,filme,')

    expect(screen.getByRole('status').textContent).toBe('filme|serie|dublado')
  })

  it('colar separa por vírgula e quebra de linha', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByPlaceholderText('novo termo'))
    await user.paste('4k, 1080p\nremux')

    expect(screen.getByRole('status').textContent).toBe('1080p|remux')
  })

  it('Backspace no campo vazio remove o último; o X remove o escolhido', async () => {
    const user = userEvent.setup()
    render(<Harness initial={['filme', 'serie', 'dublado']} />)

    await user.type(screen.getByPlaceholderText('novo termo'), '{Backspace}')
    await user.click(screen.getByRole('button', { name: 'remover filme' }))

    expect(screen.getByRole('status').textContent).toBe('serie')
  })
})
