'use strict';

const { findAll, findOne } = require('./normalize');
const { extractTitle } = require('./title');
const {
  RESOLUTIONS,
  SOURCES,
  CONTAINERS,
  VIDEO_CODECS,
  AUDIO_CODECS,
  HDR_FORMATS,
} = require('./tags');

const YEAR_RE = /\b(19\d{2}|20\d{2})\b/;
const EPISODE_RE = /\bs(\d{1,2})\s?e(\d{1,3})\b/;

// "Temporada 3", "3 Temporada" (de "3ª") e "S03" -- as tres formas aparecem.
const SEASON_RES = [
  /\b(?:season|temporada)\s*(\d{1,2})\b/,
  /\b(\d{1,2})\s*[ao]?\s*(?:season|temporada)\b/,
  /\bs(\d{1,2})(?=\s|$)/,
];

function findSeason(text) {
  for (const regex of SEASON_RES) {
    const match = text.match(regex);
    if (match) return Number(match[1]);
  }
  return null;
}

/** "S02" para temporada inteira, "S01E09" com episodio, "E1168" para anime. */
function seasonTag(season, episode) {
  const ep = episode === null ? null : `E${String(episode).padStart(2, '0')}`;
  if (season === null) return ep;

  const tag = `S${String(season).padStart(2, '0')}`;
  return ep === null ? tag : tag + ep;
}

function buildCanonical(info) {
  const tags = [info.resolution, info.source, info.videoCodec, ...info.audio, ...info.hdr];

  return [info.title, seasonTag(info.season, info.episode), info.year && `(${info.year})`, ...tags]
    .filter(Boolean)
    .join(' ');
}

module.exports = {
  name: 'release',

  classify(text, raw) {
    const { title, episodeFromTitle } = extractTitle(raw);

    const episodeMatch = text.match(EPISODE_RE);
    const season = episodeMatch ? Number(episodeMatch[1]) : findSeason(text);
    const episode = episodeMatch ? Number(episodeMatch[2]) : episodeFromTitle;
    const year = text.match(YEAR_RE);

    const info = {
      title,
      year: year ? Number(year[1]) : null,
      type: season === null && episode === null ? 'movie' : 'series',
      season,
      episode,
      resolution: findOne(text, RESOLUTIONS),
      source: findOne(text, SOURCES),
      videoCodec: findOne(text, VIDEO_CODECS),
      container: findOne(text, CONTAINERS),
      audio: findAll(text, AUDIO_CODECS),
      hdr: findAll(text, HDR_FORMATS),
    };

    return { ...info, canonical: buildCanonical(info) };
  },
};
