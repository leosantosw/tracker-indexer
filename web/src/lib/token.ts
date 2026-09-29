import { readStored, writeStored } from '@/lib/storage'

const TOKEN_KEY = 'tracker-indexer:admin-token'

export const adminToken = {
  get: () => readStored(TOKEN_KEY) ?? '',
  set: (value: string) => writeStored(TOKEN_KEY, value),
}
