'use strict';

const { defineHtmlSource } = require('./html/defineHtmlSource');

const BASE_URL = 'https://comando1.com';

/** "Toy Story 5 Torrent (2026) Dual Áudio 5.1 WEB-DL 1080p" -> "Toy Story 5 (2026)". */
function cleanTitle(title) {
  const upToYear = title.match(/^(.*?\(\d{4}\))/)?.[1] ?? title;
  return upToYear.replace(/\s+Torrent\b/i, '').trim();
}

/**
 * WordPress, mais novo primeiro. Cada titulo traz um magnet por qualidade
 * (1080p, 4K...), e cada um vira um item. Nao publica seeders.
 * So filmes, como no redes-torrents: serie ainda nao tem desenho no catalogo.
 */
module.exports = defineHtmlSource({
  name: 'comando',
  rps: 1,
  pages: 10,
  stopAfterQuietPages: 2,
  rules: { requireYear: true },

  list: {
    url: (page) => (page === 1 ? `${BASE_URL}/` : `${BASE_URL}/page/${page}/`),
    rows: 'article',
    fields: { url: 'h2.entry-title a@href', title: 'h2.entry-title a', kind: '@class' },
  },

  detail: { fields: {}, magnets: 'a[href^="magnet:"]' },

  accept: (card) => /\bcategory-filmes\b/.test(card.kind ?? '') && !/\bcategory-series?\b/.test(card.kind ?? ''),

  // O `dn` costuma vir com o titulo original ("Ice.Cream.Man.2026..."): o
  // titulo em portugues da listagem entra na frente, e as marcas vem do magnet.
  nameOf: ({ card, release }) => (card.title ? `${cleanTitle(card.title)}. ${release}` : release),
});
