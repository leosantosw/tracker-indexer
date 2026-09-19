'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const { openDb } = require('../src/db');
const { createRepo } = require('../src/db/repo');
const { syncSource } = require('../src/job/sync');

const config = { sync: { maxPagesPerTerm: 20, maxPagesPerRun: 100 } };
const log = () => {};

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

const run = (source, db, cfg = config) =>
  syncSource(source, { repo: createRepo(db), config: cfg, log });

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

test('respeita o teto de paginas da run', async () => {
  const db = openDb(':memory:');
  const pages = Array.from({ length: 50 }, (_, i) => [torrent(i + 1)]);
  const source = fakeSource(pages);

  await run(source, db, { sync: { maxPagesPerTerm: 100, maxPagesPerRun: 5 } });

  assert.equal(source.calls, 5);
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
