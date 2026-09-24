'use strict';

const trailerScore = (video) =>
  (video.type === 'Trailer' ? 100 : video.type === 'Teaser' ? 50 : 0) +
  (video.iso_639_1 === 'pt' ? 20 : 0) +
  (video.official ? 5 : 0);

function pickTrailer(videos = []) {
  const best = videos
    .filter((video) => video.site === 'YouTube' && video.key && trailerScore(video) >= 50)
    .sort((a, b) => trailerScore(b) - trailerScore(a))[0];

  return best?.key ?? null;
}

module.exports = { pickTrailer };
