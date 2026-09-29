import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'

import { unmatchedStatusSchema } from '@/lib/schemas'

export const UNMATCHED_SECTION_ID = 'sem-match'

const filterParsers = {
  status: parseAsStringLiteral(unmatchedStatusSchema.options),
  tracker: parseAsString,
}

export const useUnmatchedFilters = () => useQueryStates(filterParsers)
