'use strict';

const { defineHtmlSource } = require('../html/defineHtmlSource');
const { cleanPostTitle } = require('../html/postTitle');

const BASE_URL = 'https://comando1.com';

const isSection = (text) => text === text.toUpperCase() && !/\bassistir\b/i.test(text);

function kindOf(card) {
  if (/\bcategory-series?\b/.test(card.kind ?? '')) return 'series';
  if (/\bcategory-filmes\b/.test(card.kind ?? '')) return 'movie';
  return null;
}

module.exports = defineHtmlSource({
  name: 'comando',
  site: BASE_URL,
  access: 'public',
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

  detail: { magnets: 'a[href^="magnet:"]', sections: 'strong', isSection },

  kindOf,

  nameOf: ({ card, release, context }) => {
    if (!card.title) return release;
    const title = cleanPostTitle(card.title);
    return kindOf(card) === 'series' ? `${title}. ${context}. ${release}` : `${title}. ${release}`;
  },
});
