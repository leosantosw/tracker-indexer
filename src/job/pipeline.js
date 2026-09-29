'use strict';

const { createSources, createTmdbClient } = require('../sources');
const { syncSource } = require('./sync');
const { enrich } = require('./enrich');
const { createProgress } = require('./progress');
const { checkCache } = require('./cacheCheck');
const { createDebrid, providerOf } = require('../debrid');
const { describeSourceRun, describeTmdbRun, describeCacheRun } = require('./summary');

/**
 * What a job hands back to the runner. `skipped` means nothing was done;
 * `reason` is a stable code the panel turns into text.
 */
const OUTCOME = {
  noTmdbKey: { skipped: true, reason: 'no-tmdb-key' },
  noDebrid: { skipped: true, reason: 'no-debrid' },
  noCacheLookup: { skipped: true, reason: 'no-cache-lookup' },
};

const UNCONFIGURED = new Set(['not_configured', 'missing_token']);

function debridFor(config) {
  const provider = providerOf(config);
  if (!provider) return { outcome: OUTCOME.noDebrid };
  if (!provider.cacheBatch) return { outcome: OUTCOME.noCacheLookup };

  try {
    return { provider, debrid: createDebrid(config, { timeoutMs: 60000 }) };
  } catch (err) {
    if (UNCONFIGURED.has(err.code)) return { outcome: OUTCOME.noDebrid };
    throw err;
  }
}

async function cacheStep({ repo, config, log, signal, progress }) {
  const { provider, debrid, outcome } = debridFor(config);
  if (outcome) {
    log.warn('debrid', outcome === OUTCOME.noDebrid ? 'sem debrid configurado: o cache não foi verificado' : 'o debrid escolhido não tem consulta de cache');
    progress.endCache('skipped', outcome.reason);
    return outcome;
  }

  const startedAt = Date.now();
  const total = await checkCache({
    repo,
    debrid,
    providerId: provider.id,
    batchSize: provider.cacheBatch,
    log,
    signal,
    onStart: progress.startCache,
    onBatch: progress.cacheBatch,
  });
  progress.endCache('done');
  log.info('debrid', total.checked ? describeCacheRun(total, Date.now() - startedAt) : 'nada novo para verificar no cache');
  return {};
}

/**
 * Segundo passo, compartilhado por `sync` e `enrich`. Roda depois das regras
 * do tracker: elas apagam quase um quarto do catalogo, e consultar antes seria
 * gastar chamada em item que vai embora em seguida.
 */
async function enrichStep({ repo, config, log, signal, progress }) {
  // Before the key check: without TMDB the works still exist, just `pending`.
  const registered = repo.registerWorks();
  if (registered) log.info('catálogo', `${registered.toLocaleString('pt-BR')} ${registered === 1 ? 'obra nova' : 'obras novas'} no catálogo`);

  const tmdb = createTmdbClient(config, { signal });
  if (!tmdb) {
    log.warn('tmdb', 'sem TMDB_API_KEY: capas e notas não foram buscadas');
    progress.endTmdb('skipped', OUTCOME.noTmdbKey.reason);
    return OUTCOME.noTmdbKey;
  }

  const startedAt = Date.now();
  let total;
  try {
    total = await enrich({
      repo,
      tmdb,
      config,
      log,
      signal,
      onStart: progress.startTmdb,
      onStep: progress.tmdbStep,
    });
  } finally {
    repo.refreshLeads();
  }
  progress.endTmdb('done');
  if (!total.seen && !total.failed) {
    log.info('tmdb', 'nada novo para consultar');
    return {};
  }

  log.info('tmdb', describeTmdbRun(total, Date.now() - startedAt));
  return {};
}

/** `report` receives the structured progress (the panel); the CLI omits it. */
async function runEnrich({ repo, config, log, signal, report }) {
  const progress = createProgress(report);
  const outcome = await enrichStep({ repo, config, log, signal, progress });
  progress.finish();
  return outcome;
}

async function runCacheCheck({ repo, config, log, signal, report }) {
  const progress = createProgress(report, { tmdb: false, cache: true });
  try {
    return await cacheStep({ repo, config, log, signal, progress });
  } finally {
    progress.finish();
  }
}

async function cacheAfterSync({ repo, config, log, signal, progress }) {
  try {
    await cacheStep({ repo, config, log, signal, progress });
  } catch (err) {
    if (signal?.aborted) throw err;
    log.error('debrid', `a verificação de cache falhou: ${err.message}`);
    progress.endCache('failed', 'cache-failed');
    progress.warn(null, `a verificação de cache falhou: ${err.message}`);
  }
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
  if (!sources.length) log.warn('catálogo', 'nenhum tracker adicionado: não há o que atualizar');
  const checksCache = Boolean(config.debrid.checkCache);
  const progress = createProgress(report, { sources, cache: checksCache });

  for (const source of sources) {
    signal?.throwIfAborted();
    progress.startSource(source.name);
    const startedAt = Date.now();

    const total = await syncSource(source, {
      repo,
      config,
      log,
      signal,
      onPage: (page) => progress.page(source.name, page),
      onWarn: (text) => progress.warn(source.name, text),
    });
    log.info(source.name, describeSourceRun(total, Date.now() - startedAt));
    progress.endSource(source.name, { removed: total.removed.noYear + total.removed.duplicate });
  }

  // A TMDB fora do ar nao pode derrubar o sync: o dado do tracker ja esta
  // gravado, e torrent que some nao volta -- capa, sim, na proxima run.
  let reason = null;
  try {
    ({ reason = null } = await enrichStep({ repo, config, log, signal, progress }));
  } catch (err) {
    if (signal?.aborted) throw err;
    log.error('tmdb', `a TMDB falhou: ${err.message}`);
    progress.endTmdb('failed', 'tmdb-failed');
    progress.warn(null, `a TMDB falhou: ${err.message}`);
    reason = 'tmdb-failed';
  }

  try {
    if (checksCache) await cacheAfterSync({ repo, config, log, signal, progress });
  } finally {
    progress.finish();
  }
  return reason ? { reason } : {};
}

module.exports = { runSync, runEnrich, runCacheCheck };
