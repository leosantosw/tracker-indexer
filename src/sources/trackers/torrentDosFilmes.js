'use strict';

const { defineHtmlSource } = require('../html/defineHtmlSource');
const { cleanPostTitle } = require('../html/postTitle');

const BASE_URL = 'https://torrentdosfilmes2.xyz';

const isSection = (text) => /^vers[ãa]o\b/i.test(text);

function kindOf(card) {
  if (/\bblue\b/.test(card.kind ?? '')) return 'series';
  if (/\bgreen\b/.test(card.kind ?? '')) return 'movie';
  return null;
}

module.exports = defineHtmlSource({
  name: 'torrent-dos-filmes',
  rps: 1,
  pages: 10,
  stopAfterQuietPages: 2,
  content: 'both',
  rules: { requireYear: true },

  list: {
    url: (page) => (page === 1 ? `${BASE_URL}/?s=` : `${BASE_URL}/page/${page}/?s=`),
    rows: 'div.post',
    fields: { url: '.title a@href', title: '.title a', kind: '@class' },
  },

  detail: { magnets: 'a[href^="magnet:"]', sections: 'strong, em', isSection },

  kindOf,

  nameOf: ({ card, release, context }) => {
    if (!card.title) return release;
    const title = cleanPostTitle(card.title);
    return kindOf(card) === 'series' ? `${title}. ${context}. ${release}` : `${title}. ${release}`;
  },
});
