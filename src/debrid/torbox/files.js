'use strict';

const { matchable } = require('../../lib/classifier/normalize');
const { parseSeries } = require('../../lib/classifier/series');

const VIDEO_EXT = /\.(mkv|mp4|m4v|avi|mov|wmv|webm|ts|m2ts|mpe?g)$/i;
const SAMPLE = /(^|[\W_])sample([\W_]|$)/i;
const FAILED_STATE = /error|failed|missing|invalid/i;
const BARE_EPISODE = /^(\d{1,3})(?:\s|$)/;

const nameOf = (file) => file.short_name || file.name || '';
const pathOf = (file) => file.name || file.short_name || '';
const isVideo = (file) => String(file.mimetype ?? '').startsWith('video/') || VIDEO_EXT.test(nameOf(file));
const bySize = (a, b) => (b.size ?? 0) - (a.size ?? 0);

function coverageOf(file) {
  const own = parseSeries(matchable(nameOf(file).replace(VIDEO_EXT, '')));
  const folder = parseSeries(matchable(pathOf(file)));
  const bare = matchable(nameOf(file).replace(VIDEO_EXT, '')).match(BARE_EPISODE);

  return {
    season: own.season ?? folder.season,
    episode: own.episode ?? (bare ? Number(bare[1]) : null),
    episodeEnd: own.episode === null ? null : own.episodeEnd,
  };
}

function videosOf(files = []) {
  const videos = files.filter(isVideo);
  const kept = videos.filter((file) => !SAMPLE.test(nameOf(file)));

  return (kept.length ? kept : videos).map((file) => ({
    id: file.id,
    name: nameOf(file),
    size: file.size ?? null,
    ...coverageOf(file),
  }));
}

const inSeason = (video, season) => season === undefined || season === null || video.season === null || video.season === season;

const hasEpisode = (video, episode) =>
  video.episode !== null && episode >= video.episode && episode <= (video.episodeEnd ?? video.episode);

function pickVideo(videos, { season = null, episode = null } = {}) {
  if (videos.length === 1) return videos[0];
  if (episode !== null) return videos.filter((video) => inSeason(video, season) && hasEpisode(video, episode)).sort(bySize)[0] ?? null;

  if (season !== null) {
    const episodes = videos.filter((video) => video.season === season && video.episode !== null);
    return episodes.sort((a, b) => a.episode - b.episode)[0] ?? null;
  }

  return [...videos].sort(bySize)[0] ?? null;
}

const toFile = ({ id, name, size, season, episode }) => ({ id, name, size, season, episode });

const listed = (videos) =>
  videos
    .map(toFile)
    .sort((a, b) => (a.season ?? 0) - (b.season ?? 0) || (a.episode ?? 0) - (b.episode ?? 0) || a.name.localeCompare(b.name));

const isFinished = (torrent) => Boolean(torrent.download_finished && torrent.download_present);
const hasFailed = (torrent) => FAILED_STATE.test(String(torrent.download_state ?? ''));

const progressOf = (torrent) => ({
  status: 'downloading',
  progress: Math.round(Math.min(Math.max(Number(torrent.progress) || 0, 0), 1) * 100),
  eta: Number(torrent.eta) > 0 ? Math.round(torrent.eta) : null,
  state: torrent.download_state ?? null,
});

module.exports = { videosOf, pickVideo, toFile, listed, isFinished, hasFailed, progressOf };
