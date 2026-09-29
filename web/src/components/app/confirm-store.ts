import { create } from 'zustand'

type ConfirmRequest = {
  title: string
  description?: string
  confirmLabel?: string
}

type ConfirmState = {
  request: (ConfirmRequest & { resolve: (ok: boolean) => void }) | null
  open: (request: ConfirmRequest) => Promise<boolean>
  settle: (ok: boolean) => void
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  request: null,
  open: (request) => new Promise((resolve) => set({ request: { ...request, resolve } })),
  settle: (ok) => {
    get().request?.resolve(ok)
    set({ request: null })
  },
}))

export const confirmAction = (request: ConfirmRequest) => useConfirmStore.getState().open(request)
