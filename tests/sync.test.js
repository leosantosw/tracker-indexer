'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const { openDb } = require('../src/db');
const { createRepo } = require('../src/db/repo');
const { syncSource } = require('../src/job/sync');

const { createLogger, silentLogger: log } = require('../src/lib/logger');

const torrent = (n) => ({
  infohash: String(n).padStart(40, '0'),
  name: `Filme ${n} (2024) 1080p WEB-DL x264 Dublado`,
  size_bytes: 1000 + n,
  created_unix: 1700000000 + n,
  seeders: n,
  leechers: 0,
});

function fakeSource(pages) {
  return {
    name: 'fake',
    terms: ['teste'],
    calls: 0,

    async fetchPage({ cursor }) {
      this.calls++;
      const index = cursor ? Number(cursor) : 0;
      return {
        items: pages[index] ?? [],
        nextCursor: index + 1 < pages.length ? String(index + 1) : null,
      };
    },

    toItem: (raw) => ({
      sourceId: raw.infohash,
      infohash: raw.infohash,
      name: raw.name,
      sizeBytes: raw.size_bytes,
      createdUnix: raw.created_unix,
      seeders: raw.seeders,
      leechers: raw.leechers,
    }),
  };
}

const run = (source, db) => syncSource(source, { repo: createRepo(db), log });

const countItems = (db) => db.prepare('SELECT COUNT(*) AS n FROM item').get().n;

test('grava os itens da primeira run', async () => {
  const db = openDb(':memory:');
  const total = await run(fakeSource([[torrent(1), torrent(2)], [torrent(3)]]), db);

  assert.equal(total.inserted, 3);
  assert.equal(countItems(db), 3);
  db.close();
});

test('rodar duas vezes nao duplica nem insere de novo', async () => {
  const db = openDb(':memory:');
  const pages = [[torrent(1), torrent(2)], [torrent(3)]];

  const first = await run(fakeSource(pages), db);
  const second = await run(fakeSource(pages), db);

  assert.equal(first.inserted, 3);
  assert.equal(second.inserted, 0);
  assert.equal(countItems(db), 3);
  db.close();
});

test('varre todas as paginas em toda run', async () => {
  const db = openDb(':memory:');
  const pages = Array.from({ length: 10 }, (_, i) => [torrent(i * 2 + 1), torrent(i * 2 + 2)]);

  const first = fakeSource(pages);
  await run(first, db);
  assert.equal(first.calls, 10);

  // Nada novo na segunda run, mas ainda assim varre tudo: um item novo com
  // poucos seeders apareceria no fim da paginacao, nao no comeco.
  const second = fakeSource(pages);
  await run(second, db);
  assert.equal(second.calls, 10);
  db.close();
});

test('stopAfterQuietPages desiste cedo quando o source pede', async () => {
  const db = openDb(':memory:');
  const pages = Array.from({ length: 10 }, (_, i) => [torrent(i * 2 + 1), torrent(i * 2 + 2)]);

  await run(fakeSource(pages), db);

  const second = { ...fakeSource(pages), stopAfterQuietPages: 3 };
  await run(second, db);
  assert.equal(second.calls, 3);
  db.close();
});

test('preserva created_at e atualiza updated_at', async () => {
  const db = openDb(':memory:');
  const pages = [[torrent(1)]];

  await run(fakeSource(pages), db);
  db.exec('UPDATE item SET created_at = 111, updated_at = 111');
  await run(fakeSource(pages), db);

  const row = db.prepare('SELECT created_at, updated_at FROM item').get();
  assert.equal(row.created_at, 111);
  assert.ok(row.updated_at > 111);
  db.close();
});

test('sem teto global: pagina ate o fim', async () => {
  const db = openDb(':memory:');
  const pages = Array.from({ length: 500 }, (_, i) => [torrent(i + 1)]);
  const source = fakeSource(pages);

  await run(source, db);

  assert.equal(source.calls, 500);
  db.close();
});

test('so o limite do proprio tracker corta a paginacao', async () => {
  const db = openDb(':memory:');
  const source = { ...fakeSource(Array.from({ length: 50 }, (_, i) => [torrent(i + 1)])), pages: 5 };

  await run(source, db);

  assert.equal(source.calls, 5);
  db.close();
});

test('tracker que repete a pagina nao prende a run para sempre', async () => {
  const db = openDb(':memory:');
  const source = fakeSource([[torrent(1)]]);
  source.fetchPage = async function () {
    this.calls++;
    return { items: [torrent(this.calls)], nextCursor: 'sempre-a-mesma' };
  };

  await run(source, db);

  assert.equal(source.calls, 2, 'a segunda pagina devolve o cursor ja visto');
  db.close();
});

test('um termo que falha nao derruba a run', async () => {
  const db = openDb(':memory:');
  const source = fakeSource([[torrent(1)]]);
  source.fetchPage = async () => {
    throw new Error('HTTP 400');
  };

  const total = await run(source, db);

  assert.equal(total.inserted, 0);
  assert.equal(countItems(db), 0);
  db.close();
});

const byPages = (pages, over = {}) => ({ ...fakeSource(pages), terms: undefined, ...over });

test('a varredura por catálogo diz por que parou', async () => {
  const pages = [[torrent(1)], [torrent(2)], [torrent(3)]];

  assert.equal((await run(byPages(pages), openDb(':memory:'))).stop, 'end');
  assert.equal((await run(byPages(pages, { pages: 2 }), openDb(':memory:'))).stop, 'cap');

  const db = openDb(':memory:');
  await run(byPages(pages), db);
  const quiet = await run(byPages(pages, { stopAfterQuietPages: 2 }), db);
  assert.deepEqual({ stop: quiet.stop, stopAfter: quiet.stopAfter, pages: quiet.pages }, { stop: 'quiet', stopAfter: 2, pages: 2 });
});

test('termos viram uma linha de debug cada, sem repetir o resumo como info', async () => {
  const entries = [];
  const logger = createLogger((entry) => entries.push(entry));
  const source = { ...fakeSource([[torrent(1)]]), terms: ['dublado', 'dual'] };

  const total = await syncSource(source, { repo: createRepo(openDb(':memory:')), log: logger });

  assert.equal(total.terms, 2);
  assert.deepEqual(
    entries.map(({ level, message }) => `${level} ${message}`),
    ['debug termo "dublado": 1 página · +1 novo', 'debug termo "dual": 1 página · +0 novos']
  );
});

test('o tracker recebe quais ids já estão no banco, para não buscar o detalhe de novo', async () => {
  const db = openDb(':memory:');
  await run(fakeSource([[torrent(1)]]), db);
  const asked = [];
  const source = {
    ...fakeSource([[torrent(1), torrent(2)]]),
    async fetchPage({ isKnown }) {
      asked.push(await isKnown([torrent(1).infohash, torrent(2).infohash]));
      return { items: [], nextCursor: null };
    },
  };

  await run(source, db);

  assert.deepEqual([...asked[0]], [torrent(1).infohash]);
});

test('o imdb do torrent é gravado e não some quando uma run seguinte não traz', async () => {
  const db = openDb(':memory:');
  const withImdb = (imdbId) => ({ ...fakeSource([[torrent(1)]]), toItem: (raw) => ({ ...fakeSource([]).toItem(raw), imdbId }) });

  await run(withImdb('tt0111161'), db);
  await run(withImdb(null), db);

  assert.equal(db.prepare('SELECT imdb_id FROM item').get().imdb_id, 'tt0111161');
});
