'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const { createRunner } = require('../src/job/runner');

const log = () => {};

test('o runner começa com a última execução que recebeu', () => {
  const saved = { job: 'sync', result: 'done', reason: null, error: null, startedAt: 'a', finishedAt: 'b', progress: null };
  const runner = createRunner({ jobs: {}, log, last: saved });

  assert.deepEqual(runner.status().last, saved);
});

test('cada execução encerrada é entregue para ser guardada', async () => {
  const settled = [];
  const runner = createRunner({ jobs: { enrich: async () => ({ skipped: true, reason: 'no-tmdb-key' }) }, log, onSettle: (last) => settled.push(last) });

  runner.start('enrich');
  await runner.idle();

  assert.equal(settled.length, 1);
  assert.deepEqual({ job: settled[0].job, result: settled[0].result, reason: settled[0].reason }, { job: 'enrich', result: 'skipped', reason: 'no-tmdb-key' });
  assert.deepEqual(runner.status().last, settled[0]);
});
