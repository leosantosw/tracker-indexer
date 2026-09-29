import type { TmdbCandidate } from '@/lib/schemas'

const yearFits = (candidate: TmdbCandidate, year: number | null) =>
  Boolean(year && candidate.year && Math.abs(candidate.year - year) <= 1)

export const sortByYear = (candidates: TmdbCandidate[], year: number | null) =>
  candidates
    .map((candidate, index) => ({ candidate, index, fits: yearFits(candidate, year) }))
    .sort((a, b) => Number(b.fits) - Number(a.fits) || a.index - b.index)
