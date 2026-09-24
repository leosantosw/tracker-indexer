'use strict';

const { findAll, findOne } = require('./normalize');
const { extractTitle } = require('./title');
const { parseSeries } = require('./series');
const { languageOf } = require('./language');
const {
  RESOLUTIONS,
  SOURCES,
  CONTAINERS,
  VIDEO_CODECS,
  AUDIO_CODECS,
  HDR_FORMATS,
} = require('./tags');

const YEAR_RE = /\b(19\d{2}|20\d{2})\b/;

const pad = (n) => String(n).padStart(2, '0');
const span = (letter, start, end) => (end === null ? `${letter}${pad(start)}` : `${letter}${pad(start)}-${letter}${pad(end)}`);

function seasonTag({ season, seasonEnd, episode, episodeEnd }) {
  const ep = episode === null ? null : span('E', episode, episodeEnd);
  if (season === null) return ep;

  const tag = span('S', season, seasonEnd);
  return ep === null ? tag : tag + ep;
}

function buildCanonical(info) {
  const tags = [info.resolution, info.source, info.videoCodec, ...info.audio, ...info.hdr];

  return [info.title, seasonTag(info), info.year && `(${info.year})`, ...tags]
    .filter(Boolean)
    .join(' ');
}

module.exports = {
  name: 'release',

  classify(text, raw) {
    const { title, episodeFromTitle } = extractTitle(raw);

    const coverage = parseSeries(text);
    const episode = coverage.episode ?? episodeFromTitle;
    const year = text.match(YEAR_RE);

    const info = {
      title,
      year: year ? Number(year[1]) : null,
      type: coverage.season === null && episode === null ? 'movie' : 'series',
      ...coverage,
      episode,
      resolution: findOne(text, RESOLUTIONS),
      source: findOne(text, SOURCES),
      videoCodec: findOne(text, VIDEO_CODECS),
      container: findOne(text, CONTAINERS),
      audio: findAll(text, AUDIO_CODECS),
      hdr: findAll(text, HDR_FORMATS),
      language: languageOf(text),
    };

    return { ...info, canonical: buildCanonical(info) };
  },
};
