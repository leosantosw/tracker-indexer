'use strict';

const VIDEO_EXT = /\.(mkv|mp4|m4v|avi|mov|wmv|webm|ts|m2ts|mpe?g)$/i;
const SAMPLE = /(^|[\W_])sample([\W_]|$)/i;

// States TorBox reports for a download that will not finish by itself.
const FAILED_STATE = /error|failed|missing|invalid/i;

const nameOf = (file) => file.short_name || file.name || '';
const isVideo = (file) => String(file.mimetype ?? '').startsWith('video/') || VIDEO_EXT.test(nameOf(file));

/** The movie itself: the largest video that is not a sample. */
function pickVideoFile(files = []) {
  const videos = files.filter(isVideo);
  const bySize = (a, b) => (b.size ?? 0) - (a.size ?? 0);
  return videos.filter((file) => !SAMPLE.test(nameOf(file))).sort(bySize)[0] ?? videos.sort(bySize)[0] ?? null;
}

const isFinished = (torrent) => Boolean(torrent.download_finished && torrent.download_present);
const hasFailed = (torrent) => FAILED_STATE.test(String(torrent.download_state ?? ''));

/** Still working on it: what the TV shows while it polls. */
const progressOf = (torrent) => ({
  status: 'downloading',
  progress: Math.round(Math.min(Math.max(Number(torrent.progress) || 0, 0), 1) * 100),
  eta: Number(torrent.eta) > 0 ? Math.round(torrent.eta) : null,
  state: torrent.download_state ?? null,
});

module.exports = { pickVideoFile, isFinished, hasFailed, progressOf, nameOf };
