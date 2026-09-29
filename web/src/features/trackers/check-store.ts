import { create } from 'zustand'

export const useCheckStore = create<{ name: string | null }>(() => ({ name: null }))

export const openCheckDialog = (name: string) => useCheckStore.setState({ name })
