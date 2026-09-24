'use strict';

const { defineHtmlSource } = require('./html/defineHtmlSource');

const BASE_URL = 'https://redestorrents.com';

/** Serie vem um torrent por episodio; fica de fora ate haver desenho para isso. */
const SEASON_RE = /\btemporada\b/i;

/**
 * Catalogo HTML, sem API. Lista do mais novo para o mais antigo (entao
 * `stopAfterQuietPages` vale) e o magnet so existe na pagina do titulo --
 * 21 requisicoes por 20 itens. Nao publica seeders: `dedupe` nao se aplica.
 */
module.exports = defineHtmlSource({
  name: 'redes-torrents',
  rps: 1,
  pages: 10,
  stopAfterQuietPages: 2,
  rules: { requireYear: true },

  list: {
    url: (page) => `${BASE_URL}/pagina/${page}/`,
    rows: 'a.cover-link',
    fields: { url: '@href', title: 'article@data-title', kind: 'article@data-tipo' },
  },

  detail: {
    fields: { magnet: 'a[href^="magnet:"]@href', size: 'small:contains("Tamanho do Arquivo") + strong' },
  },

  accept: (card) => card.kind !== 'Séries' && !SEASON_RE.test(card.title ?? ''),

  // O `dn` traz as marcas de release antes do nome, e o classificador cortaria
  // o titulo no primeiro marcador: o nome limpo da listagem entra na frente.
  nameOf: ({ card, release }) => (card.title ? `${card.title}. ${release}` : release),
});
