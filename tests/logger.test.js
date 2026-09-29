'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const { createLogger, formatEntry, consoleSink } = require('../src/lib/logger');
const { formatDuration } = require('../src/lib/duration');

const at = new Date(2026, 8, 29, 1, 2, 3).toISOString();

test('cada nível vira uma entrada com hora, nível, origem e mensagem', () => {
  const entries = [];
  const log = createLogger((entry) => entries.push(entry), { now: () => new Date(at) });

  log.info('comando', '2 páginas');
  log.warn('tmdb', 'chave recusada');

  assert.deepEqual(entries, [
    { at, level: 'info', scope: 'comando', message: '2 páginas' },
    { at, level: 'warn', scope: 'tmdb', message: 'chave recusada' },
  ]);
});

test('no terminal as colunas ficam alinhadas e a origem longa é cortada', () => {
  assert.equal(formatEntry({ at, level: 'info', scope: 'comando', message: '2 páginas' }), '01:02:03  INFO   comando           2 páginas');
  assert.equal(
    formatEntry({ at, level: 'warn', scope: 'torrent-dos-filmes', message: 'página vazia' }),
    '01:02:03  AVISO  torrent-dos-fil…  página vazia'
  );
});

test('o terminal esconde o debug, a menos que peçam', (t) => {
  const printed = [];
  t.mock.method(console, 'log', (line) => printed.push(line));

  consoleSink({ color: false })({ at, level: 'debug', scope: 'comando', message: 'termo 1' });
  consoleSink({ color: false, minLevel: 'debug' })({ at, level: 'debug', scope: 'comando', message: 'termo 2' });

  assert.equal(printed.length, 1);
  assert.match(printed[0], /DEBUG  comando\s+termo 2$/);
});

test('duração curta com décimo, média em segundos e longa em minutos', () => {
  assert.equal(formatDuration(1830), '1,8s');
  assert.equal(formatDuration(42_400), '42s');
  assert.equal(formatDuration(65_000), '1m05s');
});
