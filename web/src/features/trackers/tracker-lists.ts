import type { Source } from '@/lib/schemas'

export const addedTrackers = (sources: Source[]) => sources.filter((source) => source.enabled)

export const availableTrackers = (sources: Source[]) => sources.filter((source) => !source.enabled)
