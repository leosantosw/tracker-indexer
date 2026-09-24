'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const torbox = require('../src/debrid/torbox');
const { videosOf, pickVideo } = require('../src/debrid/torbox/files');
const { normalizeInfohash } = require('../src/lib/infohash');
const { openDb } = require('../src/db');
const { createRepo } = require('../src/db/repo');
const { buildAuthedServer, API_TOKEN } = require('./authed');

const HASH = 'ac3ee9395349ad9a0b6ef13e1520511a6b9ee2b2';
const TOKEN = 'tb-secret-token';

const FILES = [
  { id: 1, name: 'Filme/Sample/sample.mkv', short_name: 'sample.mkv', size: 50, mimetype: 'video/x-matroska' },
  { id: 2, name: 'Filme/Filme.2024.1080p.mkv', short_name: 'Filme.2024.1080p.mkv', size: 9000, mimetype: 'video/x-matroska' },
  { id: 3, name: 'Filme/Filme.srt', short_name: 'Filme.srt', size: 10, mimetype: 'text/plain' },
];

const torrent = (over = {}) => ({
  id: 7,
  hash: HASH,
  download_state: 'cached',
  download_finished: true,
  download_present: true,
  progress: 1,
  eta: 0,
  files: FILES,
  ...over,
});

/**
 * Fake TorBox: `routes` maps a path to the `data` it answers (or a function of
 * the request). Records every call, so tests can check what was sent.
 */
function fakeTorbox(routes) {
  const calls = [];
  const fetch = async (url, init) => {
    const call = { url: new URL(url), method: init.method, headers: init.headers, body: init.body };
    calls.push(call);
    const path = call.url.pathname.replace('/v1/api', '');
    if (!(path in routes)) throw new Error(`rota nao simulada: ${call.url.pathname}`);
    const route = routes[path];

    const { status = 200, data, body } = typeof route === 'function' ? route(call) : { data: route };
    return new Response(JSON.stringify(body ?? { success: true, data }), { status });
  };
  return { fetch, calls, called: (path) => calls.filter((c) => c.url.pathname.endsWith(path)) };
}

const provider = (routes) => {
  const fake = fakeTorbox(routes);
  return { debrid: torbox.create({ token: TOKEN, fetch: fake.fetch, wait: async () => {} }), ...fake };
};

test('hash em hex ou base32 vira hex minusculo; o resto e recusado', () => {
  assert.equal(normalizeInfohash(HASH.toUpperCase()), HASH);
  assert.equal(normalizeInfohash('A'.repeat(32)), '0'.repeat(40));
  assert.equal(normalizeInfohash('nao-e-hash'), null);
});

test('o video e o maior arquivo de video que nao e sample', () => {
  assert.equal(pickVideo(videosOf(FILES)).id, 2);
  assert.deepEqual(videosOf([FILES[2]]), [], 'legenda nao e video');
});

test('em cache: adiciona e ja devolve o link do video, na primeira chamada', async () => {
  const { debrid, called } = provider({
    '/torrents/mylist': (call) => ({ data: call.url.searchParams.has('id') ? torrent() : [] }),
    '/torrents/checkcached': { [HASH]: { name: 'Filme' } },
    '/torrents/createtorrent': { torrent_id: 7, hash: HASH },
    '/torrents/requestdl': 'https://cdn.torbox.app/link-novo',
  });

  const result = await debrid.resolve(HASH);

  assert.deepEqual(result, {
    status: 'ready',
    url: 'https://cdn.torbox.app/link-novo',
    file: { id: 2, name: 'Filme.2024.1080p.mkv', size: 9000, season: null, episode: null },
    cached: true,
  });

  const [created] = called('/createtorrent');
  assert.equal(created.body.get('magnet'), `magnet:?xt=urn:btih:${HASH}`);

  const [link] = called('/requestdl');
  assert.equal(link.url.searchParams.get('file_id'), '2', 'pede o arquivo do filme, nao o sample');
  assert.equal(link.url.searchParams.get('redirect'), 'false');
});

test('o token vai no header, e so o requestdl leva na query (exigencia da TorBox)', async () => {
  const { debrid, calls } = provider({
    '/torrents/mylist': [torrent()],
    '/torrents/requestdl': 'https://cdn.torbox.app/x',
  });

  await debrid.resolve(HASH);

  for (const call of calls) {
    const isLink = call.url.pathname.endsWith('/requestdl');
    assert.equal(call.url.searchParams.get('token'), isLink ? TOKEN : null);
    assert.equal(call.headers.Authorization, isLink ? undefined : `Bearer ${TOKEN}`);
  }
});

test('fora do cache: manda baixar e responde downloading com o progresso', async () => {
  const { debrid, called } = provider({
    '/torrents/mylist': (call) =>
      ({ data: call.url.searchParams.has('id') ? torrent({ download_finished: false, download_present: false, progress: 0.253, eta: 600, download_state: 'downloading' }) : [] }),
    '/torrents/checkcached': {},
    '/torrents/createtorrent': { torrent_id: 8, hash: HASH },
  });

  const result = await debrid.resolve(HASH);

  assert.deepEqual(result, { status: 'downloading', progress: 25, eta: 600, state: 'downloading', cached: false });
  assert.equal(called('/requestdl').length, 0, 'sem link enquanto baixa');
});

test('ja na conta: nao adiciona de novo', async () => {
  const { debrid, called } = provider({
    '/torrents/mylist': [torrent()],
    '/torrents/requestdl': 'https://cdn.torbox.app/x',
  });

  assert.equal((await debrid.resolve(HASH)).status, 'ready');
  assert.equal(called('/createtorrent').length, 0);
});

test('cada consulta de um torrent pronto gera um link novo', async () => {
  let n = 0;
  const { debrid } = provider({
    '/torrents/mylist': [torrent()],
    '/torrents/requestdl': () => ({ data: `https://cdn.torbox.app/link-${++n}` }),
  });

  assert.equal((await debrid.status(HASH)).url, 'https://cdn.torbox.app/link-1');
  assert.equal((await debrid.status(HASH)).url, 'https://cdn.torbox.app/link-2');
});

test('com as vagas cheias, a TorBox enfileira: queued', async () => {
  const { debrid } = provider({
    '/torrents/mylist': [],
    '/torrents/checkcached': {},
    '/torrents/createtorrent': { queued_id: 3 },
  });

  assert.deepEqual(await debrid.resolve(HASH), { status: 'queued', cached: false });
});

test('sem arquivo de video: failed no_video', async () => {
  const { debrid } = provider({ '/torrents/mylist': [torrent({ files: [FILES[2]] })] });
  assert.deepEqual(await debrid.status(HASH), { status: 'failed', reason: 'no_video' });
});

test('status de torrent que nao esta na conta da 404', async () => {
  const { debrid } = provider({ '/torrents/mylist': [] });
  await assert.rejects(() => debrid.status(HASH), (err) => err.statusCode === 404 && err.code === 'not_found');
});

test('remover manda delete com o id do torrent', async () => {
  const { debrid, called } = provider({
    '/torrents/mylist': [torrent({ id: 42 })],
    '/torrents/controltorrent': null,
  });

  assert.deepEqual(await debrid.remove(HASH), { removed: true });
  assert.deepEqual(JSON.parse(called('/controltorrent')[0].body), { torrent_id: 42, operation: 'delete' });
});

test('token recusado vira erro claro, sem vazar o token', async () => {
  const { debrid } = provider({ '/torrents/mylist': () => ({ status: 401, body: { detail: 'Not authenticated' } }) });

  await assert.rejects(
    () => debrid.status(HASH),
    (err) => err.code === 'provider_auth' && err.statusCode === 502 && !err.message.includes(TOKEN)
  );
});

test('limite da TorBox vira 429', async () => {
  const { debrid } = provider({ '/torrents/mylist': () => ({ status: 429, body: { detail: 'slow down' } }) });
  await assert.rejects(() => debrid.status(HASH), (err) => err.statusCode === 429);
});

// --- rotas ---

async function setupApi({ debrid = { provider: 'torbox', tokens: { torbox: TOKEN } }, apps = { token: API_TOKEN } } = {}) {
  const repo = createRepo(openDb(':memory:'));
  return buildAuthedServer(repo, { base: { debrid, apps }, admin: { echo: () => {} } });
}

/** Routes build the real client, so the fake goes in place of the global fetch. */
async function withFetch(fake, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = fake.fetch;
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
}

const json = (res) => JSON.parse(res.body);

test('rota: sem provedor configurado da 503 not_configured', async () => {
  const app = await setupApi({ debrid: { provider: null, tokens: {} } });
  const res = await app.inject({ method: 'POST', url: '/api/debrid/torrents', payload: { hash: HASH } });

  assert.equal(res.statusCode, 503);
  assert.equal(json(res).code, 'not_configured');
  await app.close();
});

test('rota: sem o token do provedor da 503 missing_token', async () => {
  const app = await setupApi({ debrid: { provider: 'torbox', tokens: { torbox: null } } });
  const res = await app.inject({ url: `/api/debrid/torrents/${HASH}` });

  assert.equal(json(res).code, 'missing_token');
  await app.close();
});

test('rota: com API_TOKEN, ele e exigido', async () => {
  const app = await setupApi({ apps: { token: 'tv-token' } });

  const without = await app.inject({ url: `/api/debrid/torrents/${HASH}`, headers: { authorization: '' } });
  assert.equal(without.statusCode, 401);

  const fake = fakeTorbox({ '/torrents/mylist': [] });
  const withToken = await withFetch(fake, () =>
    app.inject({ url: `/api/debrid/torrents/${HASH}`, headers: { authorization: 'Bearer tv-token' } })
  );
  assert.equal(withToken.statusCode, 404, 'passou da autenticacao e chegou na TorBox');
  await app.close();
});

test('rota: sem API_TOKEN, nem localhost entra', async () => {
  const app = await setupApi({ apps: { token: null } });
  const res = await app.inject({ url: `/api/debrid/torrents/${HASH}` });

  assert.equal(res.statusCode, 401);
  await app.close();
});

test('rota: hash invalido da 400', async () => {
  const app = await setupApi();
  const res = await app.inject({ method: 'POST', url: '/api/debrid/torrents', payload: { hash: 'xyz' } });

  assert.equal(res.statusCode, 400);
  await app.close();
});

test('rota: ready da 200, downloading da 202, e nada fica em cache', async () => {
  const app = await setupApi();

  const ready = await withFetch(
    fakeTorbox({ '/torrents/mylist': [torrent()], '/torrents/requestdl': 'https://cdn.torbox.app/x' }),
    () => app.inject({ method: 'POST', url: '/api/debrid/torrents', payload: { hash: HASH } })
  );
  assert.equal(ready.statusCode, 200);
  assert.equal(json(ready).url, 'https://cdn.torbox.app/x');
  assert.equal(ready.headers['cache-control'], 'no-store');

  const downloading = await withFetch(
    fakeTorbox({ '/torrents/mylist': [torrent({ download_finished: false, progress: 0.5 })] }),
    () => app.inject({ method: 'POST', url: '/api/debrid/torrents', payload: { hash: HASH } })
  );
  assert.equal(downloading.statusCode, 202);
  assert.equal(json(downloading).progress, 50);
  await app.close();
});

test('rota: remover devolve removed', async () => {
  const app = await setupApi();
  const res = await withFetch(
    fakeTorbox({ '/torrents/mylist': [torrent()], '/torrents/controltorrent': null }),
    () => app.inject({ method: 'DELETE', url: `/api/debrid/torrents/${HASH}` })
  );

  assert.deepEqual(json(res), { removed: true });
  await app.close();
});

test('rota: as tres rotas aparecem no Swagger, com autenticacao', async () => {
  const app = await setupApi();
  await app.ready();
  const spec = app.swagger();

  assert.ok(spec.paths['/api/debrid/torrents'].post);
  assert.ok(spec.paths['/api/debrid/torrents/{hash}'].get);
  assert.ok(spec.paths['/api/debrid/torrents/{hash}'].delete);
  assert.ok(spec.components.securitySchemes.bearerAuth);
  await app.close();
});
