import { afterEach, describe, expect, it, vi } from 'vitest'

import { api, AuthError } from '@/lib/api'
import { adminToken } from '@/lib/token'

const respond = (status: number, body: unknown) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }))

describe('cliente da API do painel', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('manda o token salvo no Authorization', async () => {
    adminToken.set('s3cret')
    const fetch = respond(200, { required: false })

    await api.setupStatus()

    expect(fetch).toHaveBeenCalledWith('/api/admin/setup', expect.objectContaining({ headers: { Authorization: 'Bearer s3cret' } }))
  })

  it('401 vira AuthError, dizendo se já existe token', async () => {
    respond(401, { error: 'token invalido', tokenRequired: true })

    const error = await api.status().catch((err: unknown) => err)

    expect(error).toBeInstanceOf(AuthError)
    expect(error).toMatchObject({ message: 'token invalido', tokenRequired: true })
  })

  it('outros erros levam a mensagem do servidor', async () => {
    respond(409, { error: 'espere o job atual terminar' })

    await expect(api.clearSource('comando')).rejects.toThrow('espere o job atual terminar')
  })

  it('apagar sem match manda os filtros na query', async () => {
    const fetch = respond(200, { works: 2, removed: 5 })

    expect(await api.clearUnmatched({ status: 'ambiguous', source: 'comando' })).toEqual({ works: 2, removed: 5 })
    expect(fetch).toHaveBeenCalledWith('/api/admin/unmatched?status=ambiguous&source=comando', expect.objectContaining({ method: 'DELETE' }))
  })

  it('resposta fora do formato esperado é recusada', async () => {
    respond(200, { job: null })

    await expect(api.status()).rejects.toThrow()
  })
})
