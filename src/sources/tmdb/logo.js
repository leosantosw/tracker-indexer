'use strict';

const LANGUAGE_WEIGHT = { pt: 30, en: 20 };

const logoScore = (logo) =>
  (LANGUAGE_WEIGHT[logo.iso_639_1] ?? (logo.iso_639_1 ? 0 : 10)) + (logo.file_path.endsWith('.png') ? 1 : 0);

function pickLogo(logos = []) {
  const best = logos
    .filter((logo) => logo.file_path && logoScore(logo) >= 10)
    .sort((a, b) => logoScore(b) - logoScore(a) || (b.vote_average ?? 0) - (a.vote_average ?? 0))[0];

  return best?.file_path ?? null;
}

module.exports = { pickLogo };
