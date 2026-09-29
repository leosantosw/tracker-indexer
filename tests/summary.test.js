'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const { describeSourceRun, describeTmdbRun, describeStart, describeOutcome } = require('../src/job/summary');

const noneRemoved = { noYear: 0, duplicate: 0 };

test('tracker por catálogo: páginas, novos, motivo da parada e duração numa linha', () => {
  const run = { pages: 2, inserted: 0, removed: noneRemoved, terms: null, stop: 'quiet', stopAfter: 2 };

  assert.equal(describeSourceRun(run, 1830), '2 páginas · nenhum novo · parou após 2 páginas sem novidade · 1,8s');
});

test('tracker por busca resume os termos e conta o que as regras tiraram', () => {
  const run = { pages: 27, inserted: 12, removed: { noYear: 3, duplicate: 1 }, terms: 9, stop: 'end', stopAfter: null };

  assert.equal(describeSourceRun(run, 42_000), '9 termos · 27 páginas · +12 novos · 4 removidos pelas regras · 42s');
});

test('limite de páginas e erro aparecem como motivo da parada', () => {
  const base = { pages: 10, inserted: 5, removed: noneRemoved, terms: null, stopAfter: null };

  assert.match(describeSourceRun({ ...base, stop: 'cap' }, 1000), /limite de 10 páginas atingido/);
  assert.match(describeSourceRun({ ...base, stop: 'error' }, 1000), /parou num erro/);
});

test('resumo da TMDB só cita o que aconteceu', () => {
  const total = { seen: 12, ok: 10, notFound: 1, ambiguous: 1, skipped: 0, failed: 0 };

  assert.equal(describeTmdbRun(total, 8100), '12 obras consultadas · 10 casadas · 1 ambígua · 1 sem match · 8,1s');
});

test('início diz o que roda e, se for o caso, em quais trackers', () => {
  assert.equal(describeStart('sync', {}), 'Atualização do catálogo iniciada');
  assert.equal(describeStart('sync', { sources: ['comando'] }), 'Atualização do catálogo iniciada · só comando');
  assert.equal(describeStart('enrich', {}), 'Busca de capas e notas iniciada');
});

const finished = (over) => ({
  job: 'sync',
  result: 'done',
  reason: null,
  error: null,
  startedAt: '2026-09-29T01:00:00.000Z',
  finishedAt: '2026-09-29T01:00:42.000Z',
  progress: {
    sources: [{ inserted: 7 }, { inserted: 5 }],
    tmdb: { state: 'done', total: 12, ok: 10 },
  },
  ...over,
});

test('fim com sucesso resume duração, torrents novos e obras casadas', () => {
  assert.deepEqual(describeOutcome(finished()), {
    level: 'info',
    message: 'Atualização do catálogo concluída em 42s · +12 torrents novos · 10 obras casadas',
  });
});

test('fim com aviso, pulado, cancelado e com erro mudam o nível', () => {
  assert.deepEqual(describeOutcome(finished({ reason: 'tmdb-failed', progress: { sources: [{ inserted: 0 }], tmdb: { state: 'failed' } } })), {
    level: 'warn',
    message: 'Atualização do catálogo concluída em 42s · nenhum torrent novo · a TMDB falhou: capas e notas ficam para a próxima',
  });
  assert.deepEqual(describeOutcome(finished({ job: 'enrich', result: 'skipped', reason: 'no-tmdb-key', progress: null })), {
    level: 'warn',
    message: 'Busca de capas e notas pulada · sem TMDB_API_KEY: capas e notas não foram buscadas',
  });
  assert.equal(describeOutcome(finished({ result: 'cancelled' })).message, 'Atualização do catálogo cancelada após 42s');
  assert.deepEqual(describeOutcome(finished({ result: 'failed', error: 'disco cheio' })), {
    level: 'error',
    message: 'Atualização do catálogo falhou após 42s · disco cheio',
  });
});
