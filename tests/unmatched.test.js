'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const { openDb } = require('../src/db');
const { createRepo } = require('../src/db/repo');

const release = (title, year) => ({
  canonical: title,
  title,
  year,
  type: 'movie',
  season: null,
  episode: null,
  resolution: null,
  source: null,
  videoCodec: null,
  audio: [],
  hdr: [],
});

const item = (hash, title, year) => ({ sourceId: hash, infohash: hash, name: title, seeders: 1, release: release(title, year) });

function setup() {
  const db = openDb(':memory:');
  const repo = createRepo(db);
  repo.savePage('comando', [item('a1', 'Sem Par', 2020), item('a2', 'Casado', 2021), item('a3', 'Duvida', 2022)]);
  repo.savePage('redes-torrents', [item('b1', 'Sem Par', 2020), item('b2', 'Duvida', 2022)]);
  repo.registerWorks();
  repo.saveWork({ type: 'movie', title: 'Sem Par', year: 2020 }, { status: 'not_found' });
  repo.saveWork({ type: 'movie', title: 'Casado', year: 2021 }, { status: 'ok', match: { tmdbId: 1 } });
  repo.saveWork({ type: 'movie', title: 'Duvida', year: 2022 }, { status: 'ambiguous' });
  const hashes = () => db.prepare('SELECT infohash FROM item ORDER BY infohash').all().map((row) => row.infohash);
  return { repo, hashes };
}

test('apagar sem match tira os torrents das obras sem match e ambíguas, e só elas', () => {
  const { repo, hashes } = setup();

  const result = repo.clearUnmatched({});

  assert.deepEqual(result, { works: 2, removed: 4 });
  assert.deepEqual(hashes(), ['a2']);
  assert.equal(repo.listUnmatched({}).total, 0);
});

test('o filtro de status limita o que é apagado', () => {
  const { repo, hashes } = setup();

  assert.deepEqual(repo.clearUnmatched({ status: 'ambiguous' }), { works: 1, removed: 2 });
  assert.deepEqual(hashes(), ['a1', 'a2', 'b1']);
});

test('o filtro de tracker apaga só os torrents daquele tracker', () => {
  const { repo, hashes } = setup();

  assert.deepEqual(repo.clearUnmatched({ source: 'redes-torrents' }), { works: 2, removed: 2 });
  assert.deepEqual(hashes(), ['a1', 'a2', 'a3']);
  assert.equal(repo.listUnmatched({}).total, 2);
});
