'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const baseConfig = require('../src/config');
const { openDb } = require('../src/db');
const { createRepo } = require('../src/db/repo');
const { buildServer } = require('../src/api/server');
const { createSettingsStore } = require('../src/settings');

// The TV app runs from file://, which Chromium sends as Origin "null".
const TV = { origin: 'null' };

async function setup() {
  const repo = createRepo(openDb(':memory:'));
  const store = createSettingsStore(repo, { base: { ...baseConfig, apps: { token: 'tv-token' } } });
  return buildServer(repo, { store, admin: { echo: () => {} } });
}

test('o catalogo responde para outra origem', async () => {
  const app = await setup();
  const res = await app.inject({ url: '/api/movies', headers: TV });

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['access-control-allow-origin'], '*');
  await app.close();
});

test('preflight do debrid passa sem token e libera o Authorization', async () => {
  const app = await setup();
  const res = await app.inject({
    method: 'OPTIONS',
    url: '/api/debrid/torrents',
    headers: { ...TV, 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization,content-type' },
  });

  assert.equal(res.statusCode, 204);
  assert.match(res.headers['access-control-allow-headers'], /Authorization/);
  assert.match(res.headers['access-control-allow-methods'], /POST/);
  await app.close();
});

test('o preflight nao abre a rota: sem token, a chamada de verdade ainda leva 401', async () => {
  const app = await setup();
  const res = await app.inject({ method: 'POST', url: '/api/debrid/torrents', headers: TV, payload: { hash: 'a'.repeat(40) } });

  assert.equal(res.statusCode, 401);
  await app.close();
});

test('a API do painel nao ganha CORS', async () => {
  const app = await setup();
  const res = await app.inject({ url: '/api/admin/status', headers: TV });

  assert.equal(res.headers['access-control-allow-origin'], undefined);
  await app.close();
});
