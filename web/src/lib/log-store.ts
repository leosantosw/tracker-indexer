import { create } from 'zustand'

import type { LogEntry } from '@/lib/schemas'

const MAX_LINES = 1000

type LogState = {
  lines: LogEntry[]
  append: (entry: LogEntry) => void
  clear: () => void
}

export const useLogStore = create<LogState>((set) => ({
  lines: [],
  append: (entry) => set(({ lines }) => ({ lines: [...lines, entry].slice(-MAX_LINES) })),
  clear: () => set({ lines: [] }),
}))
