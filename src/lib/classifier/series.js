'use strict';

const NONE = { season: null, seasonEnd: null, episode: null, episodeEnd: null };

const range = (start, end) => {
  const from = Number(start);
  const to = end === undefined ? null : Number(end);
  return [from, to !== null && to > from ? to : null];
};

function seasonRange(text) {
  const tokens = [...text.matchAll(/\bs(\d{1,2})\b(?!\s?e\d)/g)].map((m) => Number(m[1]));
  if (new Set(tokens).size > 1) return [Math.min(...tokens), Math.max(...tokens)];

  const spelled =
    text.match(/\btemporadas?\s+(\d{1,2})\s+(?:a|ao|e)\s+(\d{1,2})\b(?!\s*episodio)/) ??
    text.match(/\b(\d{1,2})\s+(?:a|ao|e)\s+(\d{1,2})\s+temporadas?\b/);
  return spelled ? range(spelled[1], spelled[2]) : null;
}

function singleSeason(text) {
  const match =
    text.match(/\b(?:season|temporada)\s*(\d{1,2})\b/) ??
    text.match(/\b(\d{1,2})\s*[ao]?\s*(?:season|temporada)\b/) ??
    text.match(/\bs(\d{1,2})\b(?!\s?e\d)/);
  return match ? Number(match[1]) : null;
}

function taggedEpisode(text) {
  const sxe = text.match(/\bs(\d{1,2})\s?e(\d{1,3})(?:\s?e(\d{1,3})|\s(\d{1,3}))?\b/);
  if (sxe) return [Number(sxe[1]), ...range(sxe[2], sxe[3] ?? sxe[4])];

  const cross = text.match(/\b(\d{1,2})x(\d{2,3})\b/);
  if (cross) return [Number(cross[1]), Number(cross[2]), null];

  const cap = text.match(/\bcap\s*(\d{1,2})(\d{2})\b/);
  if (cap) return [Number(cap[1]), Number(cap[2]), null];

  return null;
}

function spelledEpisode(text) {
  const match =
    text.match(/\bepisodios?\s*(\d{1,3})(?:\s*(?:a|ao|e)\s*(\d{1,3}))?\b/) ??
    text.match(/\b(\d{1,3})(?:\s*(?:a|ao|e)\s*(\d{1,3}))?\s*episodios?\b/);
  return match ? range(match[1], match[2]) : null;
}

function parseSeries(text) {
  const seasons = seasonRange(text);
  if (seasons) return { ...NONE, season: seasons[0], seasonEnd: seasons[1] };

  const tagged = taggedEpisode(text);
  if (tagged) return { ...NONE, season: tagged[0], episode: tagged[1], episodeEnd: tagged[2] };

  const season = singleSeason(text);
  const episodes = spelledEpisode(text);
  if (episodes) return { ...NONE, season, episode: episodes[0], episodeEnd: episodes[1] };

  return { ...NONE, season };
}

module.exports = { parseSeries };
