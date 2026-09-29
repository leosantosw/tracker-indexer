'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const baseConfig = require('../src/config');
const { openDb } = require('../src/db');
const { createRepo } = require('../src/db/repo');
const { buildServer } = require('../src/api/server');
const { createSettingsStore } = require('../src/settings');

async function setup() {
  const repo = createRepo(openDb(':memory:'));
  const store = createSettingsStore(repo, { base: { ...baseConfig, apps: { token: 'tv-token' } } });
  return buildServer(repo, { store, admin: { echo: () => {} } });
}

test('a documentacao abre sem token', async () => {
  const app = await setup();

  const page = await app.inject({ url: '/api/docs' });
  const spec = await app.inject({ url: '/api/docs/json' });

  assert.equal(page.statusCode, 200);
  assert.match(page.headers['content-type'], /text\/html/);
  assert.equal(spec.statusCode, 200);
  assert.equal(spec.json().openapi, '3.1.0');
  await app.close();
});

test('o catalogo continua exigindo token', async () => {
  const app = await setup();

  const res = await app.inject({ url: '/api/movies' });

  assert.equal(res.statusCode, 401);
  await app.close();
});
