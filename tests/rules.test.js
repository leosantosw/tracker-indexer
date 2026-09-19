'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const { openDb } = require('../src/db');
const { createRepo } = require('../src/db/repo');

const RULES = { requireYear: true, dedupe: 'seeders' };

/** Item pronto para o savePage; so o que a regra olha importa aqui. */
const item = (sourceId, { title, year = 2020, type = 'movie', season = null, episode = null, seeders = 1 }) => ({
  sourceId,
  infohash: sourceId,
  name: title,
  sizeBytes: 1,
  createdUnix: 1,
  seeders,
  leechers: 0,
  release: {
    canonical: `${title} ${sourceId}`,
    title,
    year,
    type,
    season,
    episode,
    resolution: null,
    source: null,
    videoCodec: null,
    audio: [],
    hdr: [],
  },
});

const setup = (items, source = 'torrents-csv') => {
  const db = openDb(':memory:');
  const repo = createRepo(db);
  repo.savePage(source, items);
  return { db, repo };
};

const names = (db, source = 'torrents-csv') =>
  db.prepare('SELECT source_id FROM item WHERE source = ? ORDER BY source_id').all(source)
    .map((r) => r.source_id);

test('requireYear apaga so o que esta sem ano', () => {
  const { db, repo } = setup([
    item('com-ano', { title: 'Filme', year: 2020 }),
    item('sem-ano', { title: 'Outro', year: null }),
  ]);

  const removed = repo.applyRules('torrents-csv', RULES);

  assert.equal(removed.noYear, 1);
  assert.deepEqual(names(db), ['com-ano']);
  db.close();
});

test('duplicado fica com o de mais seeders', () => {
  const { db, repo } = setup([
    item('fraco', { title: 'Filme', year: 2020, seeders: 3 }),
    item('forte', { title: 'Filme', year: 2020, seeders: 99 }),
    item('medio', { title: 'Filme', year: 2020, seeders: 40 }),
  ]);

  const removed = repo.applyRules('torrents-csv', RULES);

  assert.equal(removed.duplicate, 2);
  assert.deepEqual(names(db), ['forte']);
  db.close();
});

test('mesmo titulo em anos diferentes nao e duplicata', () => {
  const { db, repo } = setup([
    item('original', { title: 'Cinderela', year: 1950, seeders: 5 }),
    item('remake', { title: 'Cinderela', year: 2015, seeders: 80 }),
  ]);

  repo.applyRules('torrents-csv', RULES);

  assert.deepEqual(names(db), ['original', 'remake']);
  db.close();
});

test('episodios de uma serie nao se atropelam', () => {
  const { db, repo } = setup([
    item('e01', { title: 'Serie', type: 'series', season: 1, episode: 1, seeders: 2 }),
    item('e02', { title: 'Serie', type: 'series', season: 1, episode: 2, seeders: 9 }),
    item('e02b', { title: 'Serie', type: 'series', season: 1, episode: 2, seeders: 1 }),
  ]);

  const removed = repo.applyRules('torrents-csv', RULES);

  assert.equal(removed.duplicate, 1);
  assert.deepEqual(names(db), ['e01', 'e02']);
  db.close();
});

test('empate de seeders escolhe sempre o mesmo, run apos run', () => {
  const { db, repo } = setup([
    item('a', { title: 'Filme', year: 2020, seeders: 7 }),
    item('b', { title: 'Filme', year: 2020, seeders: 7 }),
  ]);

  repo.applyRules('torrents-csv', RULES);
  const first = names(db);
  repo.applyRules('torrents-csv', RULES);

  assert.equal(first.length, 1);
  assert.deepEqual(names(db), first);
  db.close();
});

test('a regra nao vaza para outro tracker', () => {
  const db = openDb(':memory:');
  const repo = createRepo(db);
  repo.savePage('torrents-csv', [item('csv-sem-ano', { title: 'A', year: null })]);
  repo.savePage('outro', [
    item('outro-sem-ano', { title: 'B', year: null }),
    item('outro-dup1', { title: 'C', year: 2020, seeders: 1 }),
    item('outro-dup2', { title: 'C', year: 2020, seeders: 9 }),
  ]);

  repo.applyRules('torrents-csv', RULES);

  assert.deepEqual(names(db, 'torrents-csv'), []);
  assert.deepEqual(names(db, 'outro'), ['outro-dup1', 'outro-dup2', 'outro-sem-ano']);
  db.close();
});

test('source sem rules nao perde nada', () => {
  const { db, repo } = setup(
    [
      item('sem-ano', { title: 'A', year: null }),
      item('dup1', { title: 'B', year: 2020, seeders: 1 }),
      item('dup2', { title: 'B', year: 2020, seeders: 9 }),
    ],
    'outro'
  );

  const removed = repo.applyRules('outro', undefined);

  assert.deepEqual(removed, { noYear: 0, duplicate: 0 });
  assert.equal(names(db, 'outro').length, 3);
  db.close();
});
