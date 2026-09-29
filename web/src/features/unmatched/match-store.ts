import { create } from 'zustand'

import type { UnmatchedWork } from '@/lib/schemas'

export const useMatchStore = create<{ work: UnmatchedWork | null }>(() => ({ work: null }))

export const openMatchDialog = (work: UnmatchedWork) => useMatchStore.setState({ work })

export const closeMatchDialog = () => useMatchStore.setState({ work: null })
