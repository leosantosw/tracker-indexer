'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const { createRunner } = require('../src/job/runner');

const { createLogger, silentLogger: log } = require('../src/lib/logger');

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

test('início e fim viram uma linha cada, com o resumo e o nível certo', async () => {
  const entries = [];
  const logger = createLogger((entry) => entries.push(entry));
  const runner = createRunner({ jobs: { sync: async () => {}, enrich: async () => { throw new Error('disco cheio'); } }, log: logger });

  runner.start('sync', { sources: ['comando'] });
  await runner.idle();
  runner.start('enrich');
  await runner.idle();

  assert.deepEqual(
    entries.map(({ level, scope, message }) => [level, scope, message.replace(/em [\d,]+s|após [\d,]+s/, 'em Xs')]),
    [
      ['info', 'execução', 'Atualização do catálogo iniciada · só comando'],
      ['info', 'execução', 'Atualização do catálogo concluída em Xs'],
      ['info', 'execução', 'Busca de capas e notas iniciada'],
      ['error', 'execução', 'Busca de capas e notas falhou em Xs · disco cheio'],
    ]
  );
});
