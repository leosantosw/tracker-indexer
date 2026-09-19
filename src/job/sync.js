'use strict';

const { classify } = require('../lib/classifier');

/**
 * O tracker ordena por seeders e nao tem rota de "mais recentes", entao nao ha
 * como perguntar "o que mudou". Por padrao cada termo e paginado ate o fim:
 * um torrent novo com poucos seeders nasce no fundo da lista, e parar antes
 * seria nunca alcancar justamente ele.
 *
 * Repetir e inofensivo -- o upsert por (source, source_id) e idempotente.
 *
 * Um source pode definir `stopAfterQuietPages: N` para desistir do termo apos
 * N paginas seguidas sem nada novo. Faz sentido onde cada requisicao e cara
 * (tracker privado com limite diario), nao onde varrer custa 30 segundos.
 */
async function syncSource(source, { repo, config, log }) {
  const quietLimit = source.stopAfterQuietPages ?? Infinity;
  const total = { pages: 0, inserted: 0, removed: { noYear: 0, duplicate: 0 } };

  // Tracker de busca varre por termo; tracker de catalogo, por pagina.
  const terms = source.terms ?? [null];
  const maxPages = source.pages ?? config.sync.maxPagesPerTerm;

  for (const term of terms) {
    let cursor = null;
    let pages = 0;
    let quietPages = 0;

    while (pages < maxPages && total.pages < config.sync.maxPagesPerRun) {
      let page;
      try {
        page = await source.fetchPage({ term, cursor, log });
      } catch (err) {
        log(`${term ?? source.name}: ${err.message}`);
        break;
      }

      const items = page.items
        .map(source.toItem)
        .filter((item) => item.sourceId && item.name)
        .map((item) => ({ ...item, release: classify(item.name) }))
        .filter((item) => !item.release.rejected);

      const inserted = repo.savePage(source.name, items);

      total.inserted += inserted;
      total.pages++;
      pages++;
      quietPages = inserted === 0 ? quietPages + 1 : 0;
      cursor = page.nextCursor;

      if (!cursor || quietPages >= quietLimit) break;
    }

    const hitCap = pages === maxPages;
    log(`${term ?? source.name}: ${pages} paginas${hitCap ? ' (teto atingido, pode haver mais)' : ''}`);
  }

  // Depois de gravar tudo: so com a base inteira da para ver duplicata que
  // chegou por termos diferentes.
  total.removed = repo.applyRules(source.name, source.rules);

  return total;
}

module.exports = { syncSource };
