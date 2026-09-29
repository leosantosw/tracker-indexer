'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const { openDb } = require('../src/db');
const { createRepo } = require('../src/db/repo');

test('estado guarda um valor por chave e sobrescreve no lugar', () => {
  const db = openDb(':memory:');
  const repo = createRepo(db);

  assert.equal(repo.readState('lastRun'), null);
  repo.writeState('lastRun', { job: 'sync', result: 'done' });
  repo.writeState('lastRun', { job: 'enrich', result: 'failed' });

  assert.deepEqual(repo.readState('lastRun'), { job: 'enrich', result: 'failed' });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM app_state').get().n, 1);
});

test('restaurar padrões não apaga o estado', () => {
  const repo = createRepo(openDb(':memory:'));
  repo.writeState('lastRun', { job: 'sync' });

  repo.resetSettings({ keep: ['secrets'] });

  assert.deepEqual(repo.readState('lastRun'), { job: 'sync' });
});
