'use strict';

const { createSources, createTmdbClient } = require('../sources');
const { syncSource } = require('./sync');
const { enrich } = require('./enrich');

/**
 * What a job hands back to the runner. `skipped` means nothing was done;
 * `reason` is a stable code the panel turns into text.
 */
const OUTCOME = {
  noTmdbKey: { skipped: true, reason: 'no-tmdb-key' },
};

/**
 * Segundo passo, compartilhado por `sync` e `enrich`. Roda depois das regras
 * do tracker: elas apagam quase um quarto do catalogo, e consultar antes seria
 * gastar chamada em item que vai embora em seguida.
 */
async function runEnrich({ repo, config, log, signal }) {
  const tmdb = createTmdbClient(config, { signal });
  if (!tmdb) {
    log('tmdb: sem TMDB_API_KEY, enriquecimento pulado');
    return OUTCOME.noTmdbKey;
  }

  const total = await enrich({ repo, tmdb, config, log, signal });
  if (!total.seen && !total.failed) {
    log('tmdb: nada novo para consultar');
    return {};
  }

  log(
    `tmdb: ${total.ok} casadas, ${total.ambiguous} ambiguas, ` +
      `${total.notFound} sem match, ${total.skipped} ignoradas` +
      (total.failed ? `, ${total.failed} com erro` : '')
  );
  return {};
}

/** Cada parcela leva o proprio sinal: "-196 sem ano, 95 duplicados" pareceria entrada. */
function describeRemoved({ noYear, duplicate }) {
  return [noYear && `-${noYear} sem ano`, duplicate && `-${duplicate} duplicados`]
    .filter(Boolean)
    .join(', ');
}

/**
 * `only` narrows the run to some trackers; disabled ones never run. The
 * trackers' work stands on its own, so an enrich that could not run only
 * leaves a `reason` behind -- the sync itself is still done.
 */
async function runSync({ repo, config, log, signal, only }) {
  const sources = createSources(config, { signal }).filter(
    (source) => !only?.length || only.includes(source.name)
  );
  if (!sources.length) log('sync: nenhum tracker ativo para rodar');

  for (const source of sources) {
    signal?.throwIfAborted();

    const total = await syncSource(source, { repo, config, log, signal });
    const cut = describeRemoved(total.removed);
    log(`${source.name}: ${total.pages} paginas, ${total.inserted} novos${cut ? `, ${cut}` : ''}`);
  }

  // A TMDB fora do ar nao pode derrubar o sync: o dado do tracker ja esta
  // gravado, e torrent que some nao volta -- capa, sim, na proxima run.
  try {
    const { reason } = await runEnrich({ repo, config, log, signal });
    return reason ? { reason } : {};
  } catch (err) {
    if (signal?.aborted) throw err;
    log(`tmdb: ${err.message}`);
    return { reason: 'tmdb-failed' };
  }
}

module.exports = { runSync, runEnrich };
