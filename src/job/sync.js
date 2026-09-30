'use strict';

const { classify } = require('../lib/classifier');
const { wants } = require('../sources/content');
const { acceptsResolution } = require('../sources/resolution');
const { acceptsSize } = require('../sources/sizeLimit');

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
 *
 * There is no global page cap: only the tracker's own `pages` limits it. A
 * cursor seen before means the tracker is looping, and ends the term.
 */
/** `onPage` and `onWarn` feed the panel's progress; the CLI leaves them out. */
async function syncSource(source, { repo, log, signal, onPage = () => {}, onWarn = () => {} }) {
  const rules = source.rules ?? {};
  const quietLimit = source.stopAfterQuietPages ?? Infinity;
  const total = { pages: 0, inserted: 0, removed: { noYear: 0, duplicate: 0, resolution: 0, size: 0 }, terms: null, stop: 'end', stopAfter: null };

  // Tracker de busca varre por termo; tracker de catalogo, por pagina.
  const terms = source.terms ?? [null];
  const maxPages = source.pages ?? Infinity;
  if (source.terms) total.terms = source.terms.length;
  total.byCategory = Boolean(source.categories);
  const termLabel = total.byCategory ? 'a categoria' : 'o termo';

  // A tracker's own warnings (like "no magnet on this page") go to both.
  const warn = (message) => {
    log.warn(source.name, message);
    onWarn(message);
  };
  const isKnown = async (ids) => repo.knownSourceIds(source.name, ids);

  for (const [termIndex, term] of terms.entries()) {
    let cursor = null;
    let pages = 0;
    let quietPages = 0;
    let insertedByTerm = 0;
    let stop = 'end';
    const seen = new Set();

    while (pages < maxPages) {
      signal?.throwIfAborted();

      let page;
      try {
        page = await source.fetchPage({ term, cursor, log: warn, isKnown });
      } catch (err) {
        if (signal?.aborted) throw err;
        const failed = term ? `${termLabel} "${term}" falhou: ${err.message}` : `a página ${pages + 1} falhou: ${err.message}`;
        log.warn(source.name, failed);
        onWarn(failed);
        stop = 'error';
        break;
      }

      const items = page.items
        .map(source.toItem)
        .filter((item) => item.sourceId && item.name)
        .map((item) => ({ ...item, release: classify(item.name) }))
        .filter((item) => !item.release.rejected)
        .filter((item) => wants(source.content, item.release.type))
        .filter((item) => acceptsResolution(source.resolutions, item.release.resolution))
        .filter((item) => acceptsSize(source.maxSizeGb, item.sizeBytes, item.release))
        .filter((item) => !rules.requireYear || item.release.type !== 'movie' || item.release.year !== null);

      const inserted = repo.savePage(source.name, items, rules);

      total.inserted += inserted;
      total.pages++;
      pages++;
      insertedByTerm += inserted;
      quietPages = inserted === 0 ? quietPages + 1 : 0;
      onPage({ termIndex, inserted });
      cursor = page.nextCursor;

      if (!cursor) break;
      if (quietPages >= quietLimit) {
        stop = 'quiet';
        break;
      }
      if (seen.has(cursor)) {
        log.warn(source.name, `o site repetiu a página ${cursor}; a varredura parou ali`);
        onWarn('o tracker repetiu uma página; a varredura parou ali');
        stop = 'loop';
        break;
      }
      seen.add(cursor);
    }

    if (stop === 'end' && pages === maxPages) stop = 'cap';
    if (term !== null) {
      log.debug(source.name, `${total.byCategory ? 'categoria' : 'termo'} "${term}": ${pages} ${pages === 1 ? 'página' : 'páginas'} · +${insertedByTerm} ${insertedByTerm === 1 ? 'novo' : 'novos'}${stop === 'cap' ? ' · limite atingido' : ''}`);
    }
    total.stop = stop;
    total.stopAfter = stop === 'quiet' ? quietLimit : null;
  }

  // Depois de gravar tudo: so com a base inteira da para ver duplicata que
  // chegou por termos diferentes.
  total.removed = repo.applyRules(source.name, rules, { resolutions: source.resolutions, maxSizeGb: source.maxSizeGb });

  return total;
}

module.exports = { syncSource };
