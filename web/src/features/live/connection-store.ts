import { create } from 'zustand'

export const useConnectionStore = create<{ connected: boolean }>(() => ({ connected: false }))
