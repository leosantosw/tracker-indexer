'use strict';

const { matchesAny, byPopularity, yearOf } = require('./candidate');

const MAX_CHECKED = 5;
const NO_HINTS = { maxSeason: null, seasonYears: [] };

function withoutFranchise(title) {
  const cut = title.lastIndexOf(': ');
  return cut > 0 ? title.slice(cut + 2) : null;
}

const titlesOf = (title) => [title, withoutFranchise(title)].filter((text) => text && text.length >= 3);

const near = (a, b) => a !== null && b !== null && Math.abs(a - b) <= 1;

const seasonYear = (details, number) =>
  yearOf(details.seasons?.find((season) => season.season_number === number)?.air_date);

const hasSeasons = (details, { maxSeason }) => !maxSeason || (details.number_of_seasons ?? 0) >= maxSeason;

function airedWhenSeen(details, { seasonYears }) {
  if (!seasonYears.length) return true;

  const premiere = yearOf(details.first_air_date);
  const fitting = seasonYears.filter(({ season, year }) => near(seasonYear(details, season), year) || premiere === year);
  return fitting.length * 2 >= seasonYears.length;
}

const fits = (details, hints) => hasSeasons(details, hints) && airedWhenSeen(details, hints);

async function pickSeries(candidates, work, loadDetails) {
  if (!candidates.length) return { status: 'not_found' };

  const hints = work.hints ?? NO_HINTS;
  const exact = candidates.filter((candidate) => matchesAny(candidate, titlesOf(work.title))).sort(byPopularity);

  if (exact.length === 1) {
    return { status: 'ok', match: exact[0], details: await loadDetails(exact[0].tmdbId) };
  }

  const kept = [];
  for (const candidate of exact.slice(0, MAX_CHECKED)) {
    const details = await loadDetails(candidate.tmdbId);
    if (fits(details, hints)) kept.push({ candidate, details });
  }

  const [first, second] = kept;
  if (!first) return { status: 'ambiguous' };
  if (second && first.candidate.popularity < 2 * second.candidate.popularity) return { status: 'ambiguous' };
  return { status: 'ok', match: first.candidate, details: first.details };
}

module.exports = { pickSeries, titlesOf, withoutFranchise };
