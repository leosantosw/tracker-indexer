'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const { openDb } = require('../src/db');
const { createRepo } = require('../src/db/repo');
const { buildServer } = require('../src/api/server');
const baseConfig = require('../src/config');
const { createSettingsStore } = require('../src/settings');
const { generateKey } = require('../src/lib/secrets');

/** A job that only ends when told to, or when cancelled. */
function controllableJob() {
  const calls = [];
  let finish;

  const run = (options) =>
    new Promise((resolve, reject) => {
      calls.push(options);
      finish = resolve;
      options.signal.addEventListener('abort', () => reject(options.signal.reason));
    });

  return { run, calls, finish: () => finish() };
}

async function setup(admin = {}) {
  const repo = createRepo(openDb(':memory:'));
  const sync = controllableJob();
  const app = await buildServer(repo, {
    admin: { token: null, echo: () => {}, jobs: { sync: sync.run, enrich: async () => {} }, ...admin },
  });
  return { app, sync };
}

const json = (res) => JSON.parse(res.body);

test('sem token, so localhost entra', async () => {
  const { app } = await setup();

  const local = await app.inject({ url: '/api/admin/status' });
  const remote = await app.inject({ url: '/api/admin/status', remoteAddress: '10.0.0.8' });

  assert.equal(local.statusCode, 200);
  assert.equal(remote.statusCode, 401);
  await app.close();
});

test('com token, ele e exigido por header ou query', async () => {
  const { app } = await setup({ token: 's3cret' });

  const missing = await app.inject({ url: '/api/admin/status' });
  const header = await app.inject({ url: '/api/admin/status', headers: { authorization: 'Bearer s3cret' } });
  const query = await app.inject({ url: '/api/admin/settings?token=s3cret' });

  assert.equal(missing.statusCode, 401);
  assert.equal(json(missing).tokenRequired, true);
  assert.equal(header.statusCode, 200);
  assert.equal(query.statusCode, 200);
  await app.close();
});

test('a pagina do painel abre sem autenticar, a API nao', async () => {
  const { app } = await setup({ token: 's3cret' });

  const page = await app.inject({ url: '/admin' });
  const script = await app.inject({ url: '/admin/main.js' });
  const escape = await app.inject({ url: '/admin/..%2Fconfig.js' });

  assert.equal(page.statusCode, 200);
  assert.match(page.headers['content-type'], /text\/html/);
  assert.match(script.headers['content-type'], /javascript/);
  assert.equal(escape.statusCode, 404);
  await app.close();
});

test('desativa um tracker pela API', async () => {
  const { app } = await setup();

  const res = await app.inject({
    method: 'PUT',
    url: '/api/admin/settings',
    payload: { sources: { 'redes-torrents': { enabled: false } } },
  });

  const redes = json(res).sources.find((source) => source.name === 'redes-torrents');
  assert.equal(res.statusCode, 200);
  assert.equal(redes.enabled, false);
  await app.close();
});

test('settings invalido volta 400', async () => {
  const { app } = await setup();

  const badValue = await app.inject({
    method: 'PUT',
    url: '/api/admin/settings',
    payload: { tmdb: { staleDays: 0 } },
  });
  const unknown = await app.inject({
    method: 'PUT',
    url: '/api/admin/settings',
    payload: { sources: { nope: { enabled: true } } },
  });

  assert.equal(badValue.statusCode, 400);
  assert.equal(unknown.statusCode, 400);
  await app.close();
});

test('um job por vez; o segundo leva 409', async () => {
  const { app, sync } = await setup();

  const first = await app.inject({ method: 'POST', url: '/api/admin/jobs/sync', payload: { sources: ['torrents-csv'] } });
  const second = await app.inject({ method: 'POST', url: '/api/admin/jobs/enrich', payload: {} });

  assert.equal(first.statusCode, 202);
  assert.equal(json(first).running.job, 'sync');
  assert.deepEqual(sync.calls[0].sources, ['torrents-csv']);
  assert.equal(second.statusCode, 409);

  sync.finish();
  await app.close();
});

test('cancelar para o job e registra o resultado', async () => {
  const { app } = await setup();

  await app.inject({ method: 'POST', url: '/api/admin/jobs/sync', payload: {} });
  const cancel = await app.inject({ method: 'DELETE', url: '/api/admin/jobs/current' });
  assert.equal(json(cancel).running.cancelling, true);

  await new Promise((resolve) => setImmediate(resolve));
  const status = json(await app.inject({ url: '/api/admin/status' }));

  assert.equal(status.job.running, null);
  assert.equal(status.job.last.result, 'cancelled');
  await app.close();
});

test('cancelar sem job rodando leva 409', async () => {
  const { app } = await setup();

  const res = await app.inject({ method: 'DELETE', url: '/api/admin/jobs/current' });
  assert.equal(res.statusCode, 409);
  await app.close();
});

test('toda a API mora sob /api; o painel fica em /admin', async () => {
  const { app } = await setup();

  assert.equal((await app.inject({ url: '/api/health' })).statusCode, 200);
  assert.equal((await app.inject({ url: '/api/docs/json' })).statusCode, 200);
  assert.equal((await app.inject({ url: '/health' })).statusCode, 404);
  assert.equal((await app.inject({ url: '/movies' })).statusCode, 404);
  assert.equal((await app.inject({ url: '/docs' })).statusCode, 404);
  assert.equal((await app.inject({ url: '/admin/api/status' })).statusCode, 404);
  await app.close();
});

/** Real settings store with encryption on, and the token read from it. */
async function setupWithSecrets() {
  const repo = createRepo(openDb(':memory:'));
  const store = createSettingsStore(repo, { base: { ...baseConfig, secretsKey: generateKey() } });
  const app = await buildServer(repo, { store, admin: { echo: () => {}, jobs: { sync: async () => {}, enrich: async () => {} } } });
  return { app, repo, store };
}

const putSettings = (app, payload, headers = {}) =>
  app.inject({ method: 'PUT', url: '/api/admin/settings', payload, headers });

test('segredo salvo pela API nunca volta na resposta', async () => {
  const { app } = await setupWithSecrets();

  const res = await putSettings(app, { secrets: { tmdbApiKey: 'abcdef0123456789abcdef' } });
  const view = json(await app.inject({ url: '/api/admin/settings' }));

  assert.equal(res.statusCode, 200);
  assert.ok(!res.body.includes('abcdef0123456789abcdef'));
  assert.deepEqual(view.secrets.tmdbApiKey, { source: 'panel', error: null });
  await app.close();
});

test('token curto e aceito; com espaco ou vazio, recusado', async () => {
  const { app } = await setupWithSecrets();

  assert.equal((await putSettings(app, { secrets: { adminToken: 'curto' } })).statusCode, 200);

  const auth = { authorization: 'Bearer curto' };
  assert.equal((await putSettings(app, { secrets: { adminToken: '' } }, auth)).statusCode, 400);
  assert.equal((await putSettings(app, { secrets: { adminToken: 'tem espaco no meio' } }, auth)).statusCode, 400);
  await app.close();
});

test('token definido pelo painel passa a valer na hora', async () => {
  const { app } = await setupWithSecrets();
  const token = 'token-novo-do-painel-0001';

  await putSettings(app, { secrets: { adminToken: token } });

  const without = await app.inject({ url: '/api/admin/status' });
  const withToken = await app.inject({ url: '/api/admin/status', headers: { authorization: `Bearer ${token}` } });
  assert.equal(without.statusCode, 401);
  assert.equal(withToken.statusCode, 200);

  const removed = await putSettings(app, { secrets: { adminToken: null } }, { authorization: `Bearer ${token}` });
  assert.equal(removed.statusCode, 200);
  assert.equal((await app.inject({ url: '/api/admin/status' })).statusCode, 200);
  await app.close();
});

test('minVotes do painel muda a nota exibida sem reiniciar', async () => {
  const { app, repo } = await setupWithSecrets();
  repo.savePage('fake', [
    {
      sourceId: 'a',
      name: 'Filme (2024) 1080p',
      release: { canonical: 'Filme (2024) 1080p', title: 'Filme', year: 2024, type: 'movie', season: null, episode: null, resolution: '1080p', source: null, videoCodec: null, audio: [], hdr: [] },
    },
  ]);
  repo.saveWork({ type: 'movie', title: 'Filme', year: 2024 }, { status: 'ok', match: { tmdbId: 1, rating: 7.5, votes: 40 } });

  const rating = async () => json(await app.inject({ url: '/api/movies' })).movies[0].rating;

  assert.equal(await rating(), null);
  await putSettings(app, { tmdb: { minVotes: 10 } });
  assert.equal(await rating(), 7.5);
  await app.close();
});

const torrentItem = (sourceId) => ({
  sourceId,
  name: `Filme ${sourceId} (2024) 1080p`,
  release: { canonical: null, title: `Filme ${sourceId}`, year: 2024, type: 'movie', season: null, episode: null, resolution: '1080p', source: null, videoCodec: null, audio: [], hdr: [] },
});

test('apagar resultados de um tracker nao toca nos outros', async () => {
  const { app, repo } = await setupWithSecrets();
  repo.savePage('torrents-csv', [torrentItem('a'), torrentItem('b')]);
  repo.savePage('redes-torrents', [torrentItem('c')]);

  const res = await app.inject({ method: 'DELETE', url: '/api/admin/sources/torrents-csv/items' });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(json(res), { source: 'torrents-csv', removed: 2 });
  assert.deepEqual(repo.stats(), [{ source: 'redes-torrents', total: 1 }]);
  await app.close();
});

test('obra sem torrent sai da contagem, mas fica no banco como cache', async () => {
  const { app, repo } = await setupWithSecrets();
  repo.savePage('torrents-csv', [torrentItem('a')]);
  repo.saveWork({ type: 'movie', title: 'Filme a', year: 2024 }, { status: 'ok', match: { tmdbId: 1 } });
  assert.deepEqual(repo.workStats(), [{ status: 'ok', total: 1 }]);

  await app.inject({ method: 'DELETE', url: '/api/admin/sources/torrents-csv/items' });

  assert.deepEqual(repo.workStats(), []);
  assert.equal(repo.query('SELECT COUNT(*) AS n FROM work')[0].n, 1);
  await app.close();
});

test('apagar tracker desconhecido da 404', async () => {
  const { app } = await setupWithSecrets();

  const res = await app.inject({ method: 'DELETE', url: '/api/admin/sources/nope/items' });
  assert.equal(res.statusCode, 404);
  await app.close();
});

test('apagar com job rodando e recusado', async () => {
  const { app, sync } = await setup();

  await app.inject({ method: 'POST', url: '/api/admin/jobs/sync', payload: {} });
  const res = await app.inject({ method: 'DELETE', url: '/api/admin/sources/torrents-csv/items' });

  assert.equal(res.statusCode, 409);
  sync.finish();
  await app.close();
});

test('rotas de admin ficam fora do Swagger', async () => {
  const { app } = await setup();

  const spec = json(await app.inject({ url: '/api/docs/json' }));
  assert.ok(!Object.keys(spec.paths).some((path) => path.startsWith('/api/admin')));
  await app.close();
});
