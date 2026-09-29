import { create } from 'zustand'

import type { AuthError } from '@/lib/api'

type AccessState = {
  error: AuthError | null
  session: number
  deny: (error: AuthError) => void
  grant: () => void
}

export const useAccessStore = create<AccessState>((set) => ({
  error: null,
  session: 0,
  deny: (error) => set((state) => (state.error ? state : { error })),
  grant: () => set((state) => ({ error: null, session: state.session + 1 })),
}))
