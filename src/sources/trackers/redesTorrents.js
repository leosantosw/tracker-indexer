'use strict';

const { defineHtmlSource } = require('../html/defineHtmlSource');

const BASE_URL = 'https://redestorrents.com';

const SEASON_RE = /\btemporada\b/i;

const isSeries = (card) => card.kind === 'Séries' || SEASON_RE.test(card.title ?? '');

module.exports = defineHtmlSource({
  name: 'redes-torrents',
  rps: 1,
  pages: 10,
  stopAfterQuietPages: 2,
  content: 'both',
  rules: { requireYear: true },

  list: {
    url: (page) => `${BASE_URL}/pagina/${page}/`,
    rows: 'a.cover-link',
    fields: { url: '@href', title: 'article@data-title', kind: 'article@data-tipo' },
  },

  detail: {
    fields: { size: 'small:contains("Tamanho do Arquivo") + strong' },
    magnets: 'a[href^="magnet:"]',
  },

  kindOf: (card) => (isSeries(card) ? 'series' : 'movie'),

  nameOf: ({ card, release, context }) => {
    if (!card.title) return release;
    return isSeries(card) ? `${card.title}. ${context}. ${release}` : `${card.title}. ${release}`;
  },
});
