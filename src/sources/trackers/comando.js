'use strict';

const { defineHtmlSource } = require('../html/defineHtmlSource');

const BASE_URL = 'https://comando1.com';

function cleanTitle(title) {
  const upToYear = title.match(/^(.*?\(\d{4}\))/)?.[1] ?? title;
  return upToYear.replace(/\s+Torrent\b/i, '').trim();
}

function kindOf(card) {
  if (/\bcategory-series?\b/.test(card.kind ?? '')) return 'series';
  if (/\bcategory-filmes\b/.test(card.kind ?? '')) return 'movie';
  return null;
}

module.exports = defineHtmlSource({
  name: 'comando',
  rps: 1,
  pages: 10,
  stopAfterQuietPages: 2,
  content: 'both',
  rules: { requireYear: true },

  list: {
    url: (page) => (page === 1 ? `${BASE_URL}/` : `${BASE_URL}/page/${page}/`),
    rows: 'article',
    fields: { url: 'h2.entry-title a@href', title: 'h2.entry-title a', kind: '@class' },
  },

  detail: { magnets: 'a[href^="magnet:"]' },

  kindOf,

  nameOf: ({ card, release, context }) => {
    if (!card.title) return release;
    const title = cleanTitle(card.title);
    return kindOf(card) === 'series' ? `${title}. ${context}. ${release}` : `${title}. ${release}`;
  },
});
