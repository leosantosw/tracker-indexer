'use strict';

const { matchable } = require('../../lib/classifier/normalize');

const yearOf = (date) => (date ? Number(String(date).slice(0, 4)) : null);

const sameTitle = (a, b) => Boolean(a) && Boolean(b) && matchable(a) === matchable(b);

const matchesAny = (candidate, titles) =>
  titles.some((title) => sameTitle(candidate.title, title) || sameTitle(candidate.originalTitle, title));

const byPopularity = (a, b) => b.popularity - a.popularity;

function toCandidate(raw, type, genreNames = new Map()) {
  const date = (type === 'movie' ? raw.release_date : raw.first_air_date) || null;

  return {
    tmdbId: raw.id,
    title: type === 'movie' ? raw.title : raw.name,
    originalTitle: type === 'movie' ? raw.original_title : raw.original_name,
    releaseDate: date,
    year: yearOf(date),
    genres: (raw.genre_ids ?? []).map((id) => genreNames.get(id)).filter(Boolean),
    overview: raw.overview || null,
    rating: raw.vote_average ?? null,
    votes: raw.vote_count ?? null,
    posterPath: raw.poster_path || null,
    backdropPath: raw.backdrop_path || null,
    popularity: raw.popularity ?? 0,
  };
}

module.exports = { toCandidate, sameTitle, matchesAny, byPopularity, yearOf };
