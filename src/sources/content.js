'use strict';

const CONTENT = {
  movies: ['movie'],
  series: ['series'],
  both: ['movie', 'series'],
};

const CONTENT_IDS = Object.keys(CONTENT);

const wants = (content, type) => (CONTENT[content] ?? CONTENT.movies).includes(type);

module.exports = { CONTENT_IDS, wants };
