'use strict';

const DAY = 86400;

/**
 * Segundo passo do catalogo: casa cada obra com a TMDB e guarda capa, sinopse
 * e nota na tabela `work`.
 *
 * Roda sobre obras distintas, nao sobre torrents -- os 4 releases de um filme
 * sao uma consulta so. E grava tambem o que nao casou: e o `status` que evita
 * perguntar por "Hexalogia Star Wars" em toda execucao, para sempre.
 */
async function enrich({ repo, tmdb, config, log, signal }) {
  const ts = Math.floor(Date.now() / 1000);
  const staleBefore = ts - config.tmdb.staleDays * DAY;
  const retryBefore = config.tmdb.retryDays ? ts - config.tmdb.retryDays * DAY : 0;
  const pending = repo.pendingWorks(staleBefore, retryBefore);
  const total = { seen: 0, ok: 0, notFound: 0, ambiguous: 0, skipped: 0, failed: 0 };

  if (!pending.length) return total;
  log(`tmdb: ${pending.length} obras para consultar`);

  for (const work of pending) {
    signal?.throwIfAborted();

    let result;
    try {
      result = await tmdb.search(work);
    } catch (err) {
      if (signal?.aborted) throw err;
      // Chave invalida erra em toda obra: para na primeira em vez de gravar
      // 983 `not_found` que teriam de ser refeitos depois.
      if (err.status === 401) throw new Error('TMDB_API_KEY recusada pela API (401)');

      total.failed++;
      log(`tmdb: ${work.title} -- ${err.message}`);
      continue;
    }

    repo.saveWork(work, result);
    total.seen++;
    total[{ ok: 'ok', not_found: 'notFound', ambiguous: 'ambiguous', skipped: 'skipped' }[result.status]]++;
  }

  return total;
}

module.exports = { enrich };
