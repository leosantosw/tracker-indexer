'use strict';

const { test, mock } = require('node:test');
const assert = require('node:assert');

const baseConfig = require('../src/config');
const torbox = require('../src/debrid/torbox');
const { openDb } = require('../src/db');
const { createRepo } = require('../src/db/repo');
const { checkCache } = require('../src/job/cacheCheck');
const { runCacheCheck, runSync } = require('../src/job/pipeline');
const { describeCacheRun, describeOutcome } = require('../src/job/summary');
const { buildAuthedServer } = require('./authed');
const { silentLogger: log } = require('../src/lib/logger');

const hash = (n) => String(n).padStart(40, '0');
const DAY = 86400;

const item = (n, { title = `Filme ${n}`, source = 't' } = {}) => ({
  source,
  sourceId: `id-${n}`,
  infohash: hash(n),
  name: title,
  seeders: 1,
  release: {
    canonical: title,
    title,
    year: 2024,
    type: 'movie',
    season: null,
    episode: null,
    resolution: null,
    source: null,
    videoCodec: null,
    audio: [],
    hdr: [],
  },
});

function setup(items = [item(1), item(2), item(3)]) {
  const db = openDb(':memory:');
  const repo = createRepo(db);
  const bySource = Map.groupBy(items, (row) => row.source);
  for (const [source, rows] of bySource) repo.savePage(source, rows);
  return { db, repo };
}

const allPending = { cachedBefore: 0, missingBefore: 0 };

const fakeDebrid = (cachedHashes) => ({
  batches: [],
  async checkCached(hashes) {
    this.batches.push(hashes);
    return Object.fromEntries(hashes.map((value) => [value, cachedHashes.includes(value)]));
  },
});

const withTorbox = (over = {}) => ({
  ...baseConfig,
  debrid: { ...baseConfig.debrid, provider: 'torbox', tokens: { torbox: 'tb-token' }, ...over },
});

const torboxAnswer = (cachedHashes) => async (url, init) => {
  const hashes = JSON.parse(init.body).hashes;
  const data = Object.fromEntries(hashes.filter((value) => cachedHashes.includes(value)).map((value) => [value, { name: 'x' }]));
  return new Response(JSON.stringify({ success: true, data }), { headers: { 'content-type': 'application/json' } });
};

test('só entra na verificação o hash nunca visto ou com resposta vencida', () => {
  const { db, repo } = setup();
  repo.saveCacheAnswers('torbox', { [hash(1)]: true, [hash(2)]: false });
  const ts = Math.floor(Date.now() / 1000);

  const fresh = repo.pendingCacheHashes('torbox', { cachedBefore: ts - 7 * DAY, missingBefore: ts - DAY });
  db.prepare('UPDATE debrid_cache SET checked_at = ? WHERE infohash = ?').run(ts - 2 * DAY, hash(2));
  const afterADay = repo.pendingCacheHashes('torbox', { cachedBefore: ts - 7 * DAY, missingBefore: ts - DAY });

  assert.deepEqual(fresh, [hash(3)]);
  assert.deepEqual(afterADay, [hash(2), hash(3)]);
  assert.deepEqual(repo.pendingCacheHashes('alldebrid', allPending), [hash(1), hash(2), hash(3)], 'cada provedor tem as suas respostas');
});

test('resposta gravada é sobrescrita, e "não sei" não vira resposta', () => {
  const { db, repo } = setup();

  repo.saveCacheAnswers('torbox', { [hash(1)]: false, [hash(2)]: null });
  repo.saveCacheAnswers('torbox', { [hash(1)]: true });

  assert.deepEqual(repo.cachedByHash('torbox', [hash(1), hash(2)]), { [hash(1)]: true });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM debrid_cache').get().n, 1);
});

test('hash que saiu do catálogo sai também do cache gravado', () => {
  const { repo } = setup();
  repo.saveCacheAnswers('torbox', { [hash(1)]: true, [hash(9)]: true });

  assert.equal(repo.forgetOrphanCache(), 1);
  assert.deepEqual(repo.cachedByHash('torbox', [hash(1), hash(9)]), { [hash(1)]: true });
});

test('estatística por tracker conta o total, o que já foi visto e o que está em cache', () => {
  const { repo } = setup([item(1), item(2), item(3, { source: 'asc' })]);
  repo.saveCacheAnswers('torbox', { [hash(1)]: true, [hash(2)]: false });

  assert.deepEqual(
    repo.cacheStats('torbox').map((row) => ({ ...row })),
    [
      { source: 'asc', total: 1, checked: 0, cached: 0 },
      { source: 't', total: 2, checked: 2, cached: 1 },
    ]
  );
  assert.deepEqual(repo.cacheStats(null), []);
});

test('a verificação consulta em lotes do tamanho do provedor, com pausa entre eles', async () => {
  const { repo } = setup([item(1), item(2), item(3), item(4), item(5)]);
  const debrid = fakeDebrid([hash(2), hash(5)]);
  const waits = [];

  const total = await checkCache({ repo, debrid, providerId: 'torbox', batchSize: 2, log, wait: async (ms) => waits.push(ms) });

  assert.deepEqual(debrid.batches.map((batch) => batch.length), [2, 2, 1]);
  assert.equal(waits.length, 2);
  assert.deepEqual(total, { checked: 5, cached: 2, forgotten: 0 });
  assert.deepEqual(repo.cachedByHash('torbox', [hash(2), hash(3)]), { [hash(2)]: true, [hash(3)]: false });
});

test('sem debrid configurado, verificar o cache volta como pulado', async () => {
  const { repo } = setup();

  assert.deepEqual(await runCacheCheck({ repo, config: baseConfig, log }), { skipped: true, reason: 'no-debrid' });
  assert.deepEqual(await runCacheCheck({ repo, config: withTorbox({ tokens: {} }), log }), { skipped: true, reason: 'no-debrid' });
});

test('provedor sem consulta de cache em lote é pulado, sem chamar nada', async (t) => {
  t.mock.property(torbox, 'cacheBatch', undefined);
  const fetch = mock.method(globalThis, 'fetch', async () => assert.fail('não devia chamar o provedor'));
  const { repo } = setup();

  const outcome = await runCacheCheck({ repo, config: withTorbox(), log });

  fetch.mock.restore();
  assert.deepEqual(outcome, { skipped: true, reason: 'no-cache-lookup' });
});

test('o TorBox recebe os hashes no corpo de um POST e a resposta é gravada', async () => {
  const fetch = mock.method(globalThis, 'fetch', torboxAnswer([hash(1)]));
  const { repo } = setup();
  const reports = [];

  await runCacheCheck({ repo, config: withTorbox(), log, report: (progress) => reports.push(progress) });

  const [url, init] = fetch.mock.calls[0].arguments;
  fetch.mock.restore();
  assert.equal(init.method, 'POST');
  assert.equal(new URL(url).pathname, '/v1/api/torrents/checkcached');
  assert.deepEqual(JSON.parse(init.body).hashes, [hash(1), hash(2), hash(3)]);
  assert.deepEqual(repo.cachedByHash('torbox', [hash(1), hash(2)]), { [hash(1)]: true, [hash(2)]: false });
  assert.deepEqual(reports.at(-1).cache, { state: 'done', total: 3, done: 3, cached: 1, reason: null });
  assert.equal(reports.at(-1).tmdb, null, 'só a etapa de cache aparece');
});

test('com a opção ligada, a atualização do catálogo verifica o cache no fim', async () => {
  const fetch = mock.method(globalThis, 'fetch', torboxAnswer([hash(1)]));
  const { repo } = setup();
  const config = { ...withTorbox({ checkCache: true }), sources: [], tmdb: { ...baseConfig.tmdb, apiKey: null } };
  const reports = [];

  await runSync({ repo, config, log, report: (progress) => reports.push(progress) });

  fetch.mock.restore();
  assert.equal(reports.at(-1).cache.state, 'done');
  assert.deepEqual(repo.cachedByHash('torbox', [hash(1)]), { [hash(1)]: true });
});

test('com a opção desligada, a atualização nem cria a etapa de cache', async () => {
  const { repo } = setup();
  const reports = [];

  await runSync({ repo, config: { ...withTorbox(), sources: [], tmdb: { ...baseConfig.tmdb, apiKey: null } }, log, report: (p) => reports.push(p) });

  assert.equal(reports.at(-1).cache, null);
});

test('falha no provedor não derruba a atualização do catálogo', async () => {
  const fetch = mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 500 }));
  const { repo } = setup();
  const reports = [];

  const outcome = await runSync({
    repo,
    config: { ...withTorbox({ checkCache: true }), sources: [], tmdb: { ...baseConfig.tmdb, apiKey: null } },
    log,
    report: (progress) => reports.push(progress),
  });

  fetch.mock.restore();
  assert.equal(outcome.reason, 'no-tmdb-key');
  assert.equal(reports.at(-1).cache.state, 'failed');
});

test('o resumo diz quantos foram vistos e quantos estão em cache', () => {
  assert.equal(describeCacheRun({ checked: 828, cached: 234 }, 1200), '828 torrents verificados · 234 no cache (28%) · 1,2s');

  const progress = { sources: [], tmdb: null, cache: { state: 'done', done: 828, cached: 234 } };
  const outcome = describeOutcome({ job: 'cache', result: 'done', reason: null, startedAt: '2026-01-01T00:00:00Z', finishedAt: '2026-01-01T00:00:02Z', progress });
  assert.match(outcome.message, /^Verificação de cache concluída em .* · 234 de 828 no cache$/);
});

test('?cached=true lista só a obra com uma cópia em cache no provedor ativo', async () => {
  const { repo } = setup();
  for (const n of [1, 2]) repo.saveWork({ type: 'movie', title: `Filme ${n}`, year: 2024 }, { status: 'ok', match: { tmdbId: n, title: `Filme ${n}` } });
  repo.saveCacheAnswers('torbox', { [hash(1)]: true, [hash(2)]: false });
  repo.saveCacheAnswers('outro', { [hash(2)]: true });
  const app = await buildAuthedServer(repo, { base: { debrid: { ...baseConfig.debrid, provider: 'torbox', tokens: {} } } });

  const cached = JSON.parse((await app.inject('/api/movies?cached=true')).payload);
  const all = JSON.parse((await app.inject('/api/movies')).payload);

  assert.deepEqual(cached.movies.map((movie) => movie.title), ['Filme 1']);
  assert.equal(cached.total, 1);
  assert.equal(all.total, 2);
  await app.close();
});

test('sem debrid configurado, ?cached=true vem vazio em vez de ignorar o filtro', async () => {
  const { repo } = setup();
  repo.saveWork({ type: 'movie', title: 'Filme 1', year: 2024 }, { status: 'ok', match: { tmdbId: 1, title: 'Filme 1' } });
  repo.saveCacheAnswers('torbox', { [hash(1)]: true });
  const app = await buildAuthedServer(repo);

  const { movies, total } = JSON.parse((await app.inject('/api/movies?cached=true')).payload);

  assert.deepEqual({ movies, total }, { movies: [], total: 0 });
  await app.close();
});

test('o detalhe usa a resposta gravada quando o provedor não responde na hora', async () => {
  const fetch = mock.method(globalThis, 'fetch', async () => {
    throw new Error('fora do ar');
  });
  const { repo } = setup([item(1)]);
  repo.saveWork({ type: 'movie', title: 'Filme 1', year: 2024 }, { status: 'ok', match: { tmdbId: 1, title: 'Filme 1' } });
  repo.saveCacheAnswers('torbox', { [hash(1)]: true });
  const app = await buildAuthedServer(repo, { base: { debrid: { ...baseConfig.debrid, provider: 'torbox', tokens: { torbox: 'tb' } } } });
  const { movies } = JSON.parse((await app.inject('/api/movies')).payload);

  const detail = JSON.parse((await app.inject(`/api/movies/${movies[0].id}`)).payload);

  fetch.mock.restore();
  assert.equal(detail.torrents[0].cached, true);
  await app.close();
});

test('o que o detalhe descobre na hora fica gravado para o filtro', async () => {
  const fetch = mock.method(globalThis, 'fetch', torboxAnswer([hash(1)]));
  const { repo } = setup([item(1)]);
  repo.saveWork({ type: 'movie', title: 'Filme 1', year: 2024 }, { status: 'ok', match: { tmdbId: 1, title: 'Filme 1' } });
  const app = await buildAuthedServer(repo, { base: { debrid: { ...baseConfig.debrid, provider: 'torbox', tokens: { torbox: 'tb' } } } });
  const { movies } = JSON.parse((await app.inject('/api/movies')).payload);

  await app.inject(`/api/movies/${movies[0].id}`);

  fetch.mock.restore();
  assert.deepEqual(repo.cachedByHash('torbox', [hash(1)]), { [hash(1)]: true });
  await app.close();
});

test('o status do painel traz o cache por tracker do provedor ativo', async () => {
  const { repo } = setup();
  repo.saveCacheAnswers('torbox', { [hash(1)]: true });
  const app = await buildAuthedServer(repo, { base: { debrid: { ...baseConfig.debrid, provider: 'torbox', tokens: {} } } });

  const { stats } = JSON.parse((await app.inject('/api/admin/status')).payload);

  assert.deepEqual(stats.cache, [{ source: 't', total: 3, checked: 1, cached: 1 }]);
  await app.close();
});
