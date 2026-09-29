'use strict';

const { test, mock } = require('node:test');
const assert = require('node:assert');

const baseConfig = require('../src/config');
const { openDb } = require('../src/db');
const { createRepo } = require('../src/db/repo');
const { runSync, runEnrich } = require('../src/job/pipeline');
const { createRunner } = require('../src/job/runner');
const { buildAuthedServer } = require('./authed');

const log = () => {};
const noKey = { ...baseConfig, tmdb: { ...baseConfig.tmdb, apiKey: null } };
const noTrackers = (config) => ({ ...config, sources: config.sources?.map((s) => ({ ...s, enabled: false })) ?? [] });

test('enrich sem TMDB_API_KEY volta como pulado, com o motivo', async () => {
  const repo = createRepo(openDb(':memory:'));
  assert.deepEqual(await runEnrich({ repo, config: noKey, log }), { skipped: true, reason: 'no-tmdb-key' });
});

test('sync sem TMDB_API_KEY conclui, mas deixa o motivo', async () => {
  const repo = createRepo(openDb(':memory:'));
  const outcome = await runSync({ repo, config: noTrackers(noKey), log });

  assert.equal(outcome.skipped, undefined);
  assert.equal(outcome.reason, 'no-tmdb-key');
});

test('o runner registra "skipped" e o motivo, em vez de "done"', async () => {
  const runner = createRunner({ jobs: { enrich: async () => ({ skipped: true, reason: 'no-tmdb-key' }) }, log });

  runner.start('enrich');
  await runner.idle();

  const { last } = runner.status();
  assert.equal(last.result, 'skipped');
  assert.equal(last.reason, 'no-tmdb-key');
  assert.equal(last.error, null);
});

test('job que nao devolve nada continua "done"', async () => {
  const runner = createRunner({ jobs: { enrich: async () => {} }, log });

  runner.start('enrich');
  await runner.idle();

  assert.deepEqual(
    { result: runner.status().last.result, reason: runner.status().last.reason },
    { result: 'done', reason: null }
  );
});

const movieItem = (sourceId, title, year) => ({
  sourceId,
  infohash: sourceId,
  name: title,
  seeders: 1,
  release: {
    canonical: title,
    title,
    year,
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

const withTmdb = { ...baseConfig, tmdb: { ...baseConfig.tmdb, apiKey: 'k', rps: 1000 } };

const jsonResponse = (body) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

function fakeTmdbFetch(controller, abortOnQuery) {
  return async (url) => {
    const { pathname, searchParams } = new URL(url);
    if (searchParams.get('query') === abortOnQuery) {
      controller.abort();
      throw controller.signal.reason;
    }
    if (pathname.includes('/genre/')) return jsonResponse({ genres: [] });
    if (pathname.includes('/search/')) {
      return jsonResponse({ results: [{ id: 1584, title: 'Escola de Rock', release_date: '2003-10-03', genre_ids: [] }] });
    }
    return jsonResponse({ id: 1584, title: 'Escola de Rock', release_date: '2003-10-03', videos: { results: [] } });
  };
}

test('enrich cancelado ainda agrupa as obras que ja casaram', async (t) => {
  const repo = createRepo(openDb(':memory:'));
  repo.savePage('t', [
    movieItem('aaa', 'Escola De Rock', 2003),
    movieItem('bbb', 'Escola de Rock', 2003),
    movieItem('ccc', 'Zumbilandia', 2009),
  ]);
  const controller = new AbortController();
  t.after(() => mock.restoreAll());
  mock.method(globalThis, 'fetch', fakeTmdbFetch(controller, 'Zumbilandia'));

  await assert.rejects(runEnrich({ repo, config: withTmdb, log, signal: controller.signal }));
  mock.restoreAll();

  const app = await buildAuthedServer(repo);
  const { movies } = (await app.inject({ url: '/api/movies' })).json();
  const detail = (await app.inject({ url: `/api/movies/${movies[0].id}` })).json();

  assert.equal(movies.length, 1);
  assert.deepEqual(detail.torrents.map((torrent) => torrent.infohash).sort(), ['aaa', 'bbb']);
  await app.close();
});
