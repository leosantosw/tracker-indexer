'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const baseConfig = require('../src/config');
const { openDb } = require('../src/db');
const { createRepo } = require('../src/db/repo');
const { createSettingsStore } = require('../src/settings');
const { generateKey } = require('../src/lib/secrets');
const { buildAuthedServer, API_TOKEN } = require('./authed');

let hashes = 0;
const nextHash = () => (++hashes).toString(16).padStart(40, 'a');
const TORRENT_BYTES = Buffer.from('d8:announce3:urle');
const ASC = 'amigos-share-club';

const pageHtml = (page) => `<html><script data-page="app" type="application/json">${JSON.stringify(page)}</script></html>`;
const ok = (data) => new Response(JSON.stringify({ success: true, data }), { headers: { 'content-type': 'application/json' } });

function fakeWorld(hash, { cached = false, freeleech = true, loginRefused = false } = {}) {
  const site = [];
  const torbox = [];
  const fetch = async (url, init = {}) => {
    const { host, pathname } = new URL(url);
    if (host === 'amigos-share.club') {
      site.push(pathname);
      if (pathname === '/login' && !init.method) return new Response(pageHtml({ version: 'v1', props: {} }), { headers: { 'set-cookie': 'XSRF-TOKEN=t; path=/' } });
      if (pathname === '/login') return new Response(null, { status: 302, headers: { location: `https://amigos-share.club/${loginRefused ? 'login' : 'dashboard'}` } });
      if (pathname === '/torrents/101/download') return new Response(TORRENT_BYTES, { headers: { 'content-type': 'application/x-bittorrent' } });
      return new Response(pageHtml({ props: { torrent: { freeleech }, download: { url: '/torrents/101/download', unavailableReason: null } } }));
    }

    const path = pathname.replace('/v1/api', '');
    torbox.push({ path, body: init.body });
    if (path === '/torrents/mylist') return ok(new URL(url).searchParams.has('id') ? { id: 7, hash, download_state: 'downloading', download_finished: false, progress: 0.1, eta: 60, files: [] } : []);
    if (path === '/torrents/checkcached') return ok(cached ? { [hash]: { name: 'x' } } : {});
    if (path === '/torrents/createtorrent') return ok({ torrent_id: 7, hash });
    throw new Error(`rota não simulada: ${pathname}`);
  };
  return { fetch, site, torbox, created: () => torbox.find((call) => call.path === '/torrents/createtorrent')?.body };
}

async function setup(hash, { alsoPublic = false } = {}) {
  const repo = createRepo(openDb(':memory:'));
  const item = (sourceId) => ({ sourceId, infohash: hash, name: 'Filme 2024 1080p', release: { canonical: 'Filme', title: 'Filme', year: 2024, type: 'movie', season: null, episode: null, resolution: null, source: null, videoCodec: null, audio: [], hdr: [] } });
  repo.savePage(ASC, [item('101')]);
  if (alsoPublic) repo.savePage('comando1', [item('pub-1')]);

  const store = createSettingsStore(repo, {
    base: {
      ...baseConfig,
      secretsKey: generateKey(),
      admin: { token: 'admin' },
      apps: { token: API_TOKEN },
      debrid: { ...baseConfig.debrid, provider: 'torbox', tokens: { torbox: 'tb' } },
    },
  });
  store.save({
    sources: { [ASC]: { enabled: true, freeleechOnly: true, rps: 50 } },
    secrets: { [`${ASC}:username`]: 'leo', [`${ASC}:password`]: 'segredo' },
  });
  return buildAuthedServer(repo, { store, admin: { echo: () => {} } });
}

async function play(app, world, hash) {
  const original = globalThis.fetch;
  globalThis.fetch = world.fetch;
  try {
    return await app.inject({ method: 'POST', url: '/api/debrid/torrents', payload: { hash } });
  } finally {
    globalThis.fetch = original;
  }
}

test('privado fora do cache e em freeleech: manda o .torrent, não o magnet', async () => {
  const hash = nextHash();
  const app = await setup(hash);
  const world = fakeWorld(hash);

  const res = await play(app, world, hash);

  assert.equal(res.statusCode, 202);
  const form = world.created();
  assert.equal(form.get('magnet'), null);
  assert.deepEqual(Buffer.from(await form.get('file').arrayBuffer()), TORRENT_BYTES);
  assert.deepEqual(world.site.slice(-2), ['/torrents/101', '/torrents/101/download']);
  await app.close();
});

test('privado fora do cache que perdeu o freeleech: recusa com código e mensagem', async () => {
  const hash = nextHash();
  const app = await setup(hash);
  const world = fakeWorld(hash, { freeleech: false });

  const res = await play(app, world, hash);

  assert.equal(res.statusCode, 409);
  assert.deepEqual(JSON.parse(res.body), {
    error: 'Este torrent não está mais em freeleech e ainda não está no cache.',
    code: 'private_not_freeleech',
  });
  assert.equal(world.created(), undefined, 'nada chega ao debrid');
  await app.close();
});

test('privado em cache toca pelo hash, sem abrir o tracker', async () => {
  const hash = nextHash();
  const app = await setup(hash);
  const world = fakeWorld(hash, { cached: true, freeleech: false });

  await play(app, world, hash);

  assert.match(world.created().get('magnet'), new RegExp(hash));
  assert.deepEqual(world.site, []);
  await app.close();
});

test('o mesmo hash num tracker público vai por magnet, sem abrir o privado', async () => {
  const hash = nextHash();
  const app = await setup(hash, { alsoPublic: true });
  const world = fakeWorld(hash, { freeleech: false });

  await play(app, world, hash);

  assert.match(world.created().get('magnet'), new RegExp(hash));
  assert.deepEqual(world.site, []);
  await app.close();
});

test('conta recusada pelo tracker vira erro claro, sem detalhes da conta', async () => {
  const hash = nextHash();
  const app = await setup(hash);

  const res = await play(app, fakeWorld(hash, { loginRefused: true }), hash);

  assert.equal(res.statusCode, 502);
  assert.deepEqual(JSON.parse(res.body), {
    error: 'Não foi possível entrar no tracker. Confira a conta no painel.',
    code: 'private_login_failed',
  });
  assert.ok(!res.body.includes('leo'));
  await app.close();
});
