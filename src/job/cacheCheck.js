'use strict';

const DAY = 86400;
const CACHED_STALE_DAYS = 7;
const MISSING_STALE_DAYS = 1;
const BATCH_PAUSE_MS = 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function checkCache({ repo, debrid, providerId, batchSize, log, signal, wait = sleep, onStart = () => {}, onBatch = () => {} }) {
  const ts = Math.floor(Date.now() / 1000);
  const pending = repo.pendingCacheHashes(providerId, {
    cachedBefore: ts - CACHED_STALE_DAYS * DAY,
    missingBefore: ts - MISSING_STALE_DAYS * DAY,
  });
  const total = { checked: 0, cached: 0, forgotten: 0 };

  if (pending.length) {
    log.info('debrid', `verificando o cache de ${pending.length.toLocaleString('pt-BR')} ${pending.length === 1 ? 'torrent' : 'torrents'}`);
    onStart(pending.length);
  }

  for (let start = 0; start < pending.length; start += batchSize) {
    signal?.throwIfAborted();
    if (start > 0) await wait(BATCH_PAUSE_MS);

    const batch = pending.slice(start, start + batchSize);
    const answers = await debrid.checkCached(batch);
    repo.saveCacheAnswers(providerId, answers);

    const cached = batch.filter((hash) => answers[hash] === true).length;
    total.checked += batch.length;
    total.cached += cached;
    onBatch({ checked: batch.length, cached });
  }

  total.forgotten = repo.forgetOrphanCache();
  return total;
}

module.exports = { checkCache };
