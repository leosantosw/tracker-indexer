'use strict';

const VIDEO = /\.(mkv|mp4|avi|m2ts|ts|wmv|mov|m4v)$/i;
const EPISODE = /\bS(\d{1,2})E\d{1,3}(?:-?E?\d{1,3})*\b/i;

const basename = (path) => path.split('/').pop();
const withoutExtension = (name) => name.replace(/\.[a-z0-9]{2,4}$/i, '');
const pad = (season) => `S${String(season).padStart(2, '0')}`;

function seasonToken(videos) {
  const seasons = [...new Set(videos.map((path) => Number(basename(path).match(EPISODE)?.[1])).filter(Boolean))];
  if (!seasons.length) return null;
  const [first, last] = [Math.min(...seasons), Math.max(...seasons)];
  return first === last ? pad(first) : `${pad(first)}.${pad(last)}`;
}

function releaseName(listing, files) {
  const videos = files.map((file) => file.path).filter((path) => !path.startsWith('.pad/') && VIDEO.test(path));
  if (!videos.length) return [listing.name, listing.year].filter(Boolean).join(' ');

  const name = withoutExtension(basename(videos[0]));
  const episode = listing.name.match(EPISODE)?.[0];
  if (episode) return name.replace(EPISODE, episode);

  const season = seasonToken(videos);
  return season ? name.replace(EPISODE, season) : name;
}

module.exports = { releaseName };
