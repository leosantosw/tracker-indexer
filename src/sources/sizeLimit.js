'use strict';

const GB = 1024 ** 3;
const SIZE_LIMIT_KINDS = ['movie', 'episode', 'season'];

const spanLength = (start, end) => Math.max(1, (end ?? start ?? 1) - (start ?? 1) + 1);

function sizeUnitOf({ type, season, seasonEnd, episode, episodeEnd }) {
  if (type !== 'series') return { kind: 'movie', count: 1 };
  if (episode !== null && episode !== undefined) return { kind: 'episode', count: spanLength(episode, episodeEnd) };
  return { kind: 'season', count: spanLength(season, seasonEnd) };
}

function acceptsSize(maxSizeGb, sizeBytes, release) {
  if (!maxSizeGb || !sizeBytes) return true;

  const { kind, count } = sizeUnitOf(release);
  const limit = maxSizeGb[kind];
  return limit === null || limit === undefined || sizeBytes <= limit * GB * count;
}

module.exports = { GB, SIZE_LIMIT_KINDS, acceptsSize };
