'use strict';

const BASE_URL = 'https://torrents-csv.com';

/**
 * A API tem um unico endpoint: /service/search?q=<termo>&after=<cursor>.
 * `q` e obrigatorio (min. 3 caracteres) e nao existe rota de "mais recentes",
 * entao o recorte pt-br vem destes termos de busca.
 *
 * A busca e AND entre os termos, entao termo composto e sempre subconjunto do
 * simples: "dublado 1080p" nunca traz nada que "dublado" ja nao tenha.
 */
const TERMS = [
  'dublado',
  'dual áudio',
  'dublagem',
  'nacional',
  'pt-br',
  'ptbr',
  'portugues',
  'bludv',
  'lapumia',
  'comando',
  'torrentdosfilmes',
];

module.exports = {
  name: 'torrents-csv',
  rps: 2,
  terms: TERMS,

  /**
   * Regras deste tracker, e so dele: a base vem cheia de release sem ano e do
   * mesmo filme repetido em varias qualidades. Sem ano nao da para casar com
   * catalogo externo, e entre copias da mesma obra fica a mais semeada.
   */
  rules: { requireYear: true, dedupe: 'seeders' },

  create({ getJson }) {
    return {
      async fetchPage({ term, cursor }) {
        const url = new URL('/service/search', BASE_URL);
        url.searchParams.set('q', term);
        if (cursor) url.searchParams.set('after', cursor);

        const { torrents = [], next } = await getJson(url);
        return { items: torrents, nextCursor: next ? String(next) : null };
      },

      toItem(raw) {
        return {
          sourceId: raw.infohash,
          infohash: raw.infohash,
          name: raw.name,
          sizeBytes: raw.size_bytes,
          createdUnix: raw.created_unix,
          seeders: raw.seeders,
          leechers: raw.leechers,
        };
      },
    };
  },
};
