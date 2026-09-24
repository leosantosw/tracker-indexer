'use strict';

const { matchable } = require('./normalize');

const LANGUAGES = [
  ['dual', /\bdual\b/],
  ['dubbed', /\bdublad[oa]s?\b/],
  ['subtitled', /\blegendad[oa]s?\b/],
];

const languageOf = (text) => LANGUAGES.find(([, pattern]) => pattern.test(text))?.[0] ?? null;

const detectLanguage = (raw) => languageOf(matchable(raw));

module.exports = { languageOf, detectLanguage };
