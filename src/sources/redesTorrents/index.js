'use strict';

const { parseList, parseDetail } = require('./parse');

const BASE_URL = 'https://redestorrents.com';

/** Serie vem um torrent por episodio; fica de fora ate haver desenho para isso. */
const SEASON_RE = /\btemporada\b/i;
const isMovie = (card) => card.kind !== 'Séries' && !SEASON_RE.test(card.title ?? '');

/**
 * Catalogo HTML, sem API. Duas diferencas em relacao ao torrents-csv moldam o
 * source: existe listagem "mais recentes" (entao `stopAfterQuietPages` vale), e
 * o magnet so existe na pagina do titulo -- 21 requisicoes por 20 itens.
 *
 * O site nao publica seeders, entao `dedupe: 'seeders'` nao faz sentido aqui.
 */
module.exports = {
  name: 'redes-torrents',
  rps: 1,
  pages: 10,
  stopAfterQuietPages: 2,
  rules: { requireYear: true },

  create({ getText }) {
    return {
      async fetchPage({ cursor, log }) {
        const page = Number(cursor ?? 1);
        const cards = parseList(await getText(`${BASE_URL}/pagina/${page}/`)).filter(isMovie);

        const items = [];
        for (const card of cards) {
          const found = parseDetail(await getText(card.url), card.title);
          if (found) items.push(found);
        }

        if (cards.length && !items.length) {
          log?.(`${module.exports.name}: pagina ${page} sem nenhum magnet -- template mudou?`);
        }

        return { items, nextCursor: cards.length ? String(page + 1) : null };
      },

      toItem: (raw) => ({
        sourceId: raw.infohash,
        infohash: raw.infohash,
        name: raw.name,
        sizeBytes: raw.sizeBytes,
        createdUnix: null,
        seeders: null,
        leechers: null,
      }),
    };
  },
};
