'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const baseConfig = require('../src/config');
const { openDb } = require('../src/db');
const { createRepo } = require('../src/db/repo');
const { runSync, runEnrich } = require('../src/job/pipeline');
const { createRunner } = require('../src/job/runner');

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
