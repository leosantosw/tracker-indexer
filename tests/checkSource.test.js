'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const { inspectSource } = require('../src/job/checkSource');

const entryOf = (name) => ({ card: { title: name }, item: { name }, status: 'ok' });

const sourceWith = (names, over = {}) => ({
  name: 'fake',
  content: 'both',
  rules: {},
  resolutions: null,
  readPage: async () => names.map(entryOf),
  ...over,
});

test('the check marks copies outside the selected resolutions as filtered', async () => {
  const names = ['Filme Um (2024) 2160p WEB-DL', 'Filme Dois (2024) 1080p WEB-DL'];

  const result = await inspectSource(sourceWith(names, { resolutions: ['1080p'] }));

  assert.deepEqual(result.entries.map((entry) => entry.status), ['filtered', 'ok']);
  assert.deepEqual(result.totals, { filtered: 1, ok: 1 });
});

test('without resolutions the check lets every resolution in', async () => {
  const result = await inspectSource(sourceWith(['Filme Um (2024) 2160p WEB-DL', 'Filme Dois (2024) 720p WEB-DL']));

  assert.deepEqual(result.totals, { ok: 2 });
});
