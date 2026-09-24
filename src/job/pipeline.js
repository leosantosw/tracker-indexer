'use strict';

const { createSources, createTmdbClient } = require('../sources');
const { syncSource } = require('./sync');
const { enrich } = require('./enrich');
const { createProgress } = require('./progress');

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
async function enrichStep({ repo, config, log, signal, progress }) {
  // Before the key check: without TMDB the works still exist, just `pending`.
  const registered = repo.registerWorks();
  if (registered) log(`catalogo: ${registered} obras novas`);

  const tmdb = createTmdbClient(config, { signal });
  if (!tmdb) {
    log('tmdb: sem TMDB_API_KEY, enriquecimento pulado');
    progress.endTmdb('skipped', OUTCOME.noTmdbKey.reason);
    return OUTCOME.noTmdbKey;
  }

  const total = await enrich({
    repo,
    tmdb,
    config,
    log,
    signal,
    onStart: progress.startTmdb,
    onStep: progress.tmdbStep,
  });
  progress.endTmdb('done');
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

/** `report` receives the structured progress (the panel); the CLI omits it. */
async function runEnrich({ repo, config, log, signal, report }) {
  const progress = createProgress(report);
  const outcome = await enrichStep({ repo, config, log, signal, progress });
  progress.finish();
  return outcome;
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
async function runSync({ repo, config, log, signal, only, report }) {
  const sources = createSources(config, { signal }).filter(
    (source) => !only?.length || only.includes(source.name)
  );
  if (!sources.length) log('sync: nenhum tracker ativo para rodar');
  const progress = createProgress(report, { sources });

  for (const source of sources) {
    signal?.throwIfAborted();
    progress.startSource(source.name);

    const total = await syncSource(source, {
      repo,
      config,
      log,
      signal,
      onPage: (page) => progress.page(source.name, page),
      onWarn: (text) => progress.warn(source.name, text),
    });
    const cut = describeRemoved(total.removed);
    log(`${source.name}: ${total.pages} paginas, ${total.inserted} novos${cut ? `, ${cut}` : ''}`);
    progress.endSource(source.name, { removed: total.removed.noYear + total.removed.duplicate });
  }

  // A TMDB fora do ar nao pode derrubar o sync: o dado do tracker ja esta
  // gravado, e torrent que some nao volta -- capa, sim, na proxima run.
  try {
    const { reason } = await enrichStep({ repo, config, log, signal, progress });
    return reason ? { reason } : {};
  } catch (err) {
    if (signal?.aborted) throw err;
    log(`tmdb: ${err.message}`);
    progress.endTmdb('failed', 'tmdb-failed');
    progress.warn(null, `a TMDB falhou: ${err.message}`);
    return { reason: 'tmdb-failed' };
  } finally {
    progress.finish();
  }
}

module.exports = { runSync, runEnrich };
