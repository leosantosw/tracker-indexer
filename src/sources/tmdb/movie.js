'use strict';

const { matchesAny, byPopularity } = require('./candidate');

function pickMatch(candidates, work) {
  if (!candidates.length) return { status: 'not_found' };

  const exact = candidates.filter((candidate) => matchesAny(candidate, [work.title]));

  if (work.year !== null) {
    const pool = (exact.length ? exact : candidates)
      .filter((candidate) => candidate.year !== null && Math.abs(candidate.year - work.year) <= 1)
      .sort(byPopularity);

    return pool.length ? { status: 'ok', match: pool[0] } : { status: 'ambiguous' };
  }

  if (!exact.length) return { status: 'ambiguous' };

  const [first, second] = exact.sort(byPopularity);
  if (exact.length === 1 || first.popularity >= 2 * second.popularity) return { status: 'ok', match: first };
  return { status: 'ambiguous' };
}

module.exports = { pickMatch };
