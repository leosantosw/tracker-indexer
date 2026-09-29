'use strict';

const { test, mock } = require('node:test');
const assert = require('node:assert');

const baseConfig = require('../src/config');
const { createCacheStatus } = require('../src/debrid/cacheStatus');

const HASH = 'ac3ee9395349ad9a0b6ef13e1520511a6b9ee2b2';

const torboxConfig = { ...baseConfig, debrid: { provider: 'torbox', tokens: { torbox: 'tb-token' } } };

const storeWith = (config) => ({ config: () => config, onChange: () => {} });

function setup(config) {
  const lines = [];
  let clock = 0;
  const cacheStatus = createCacheStatus({
    store: storeWith(config),
    now: () => clock,
    log: (line) => lines.push(line),
  });
  return { cacheStatus, lines, advance: (ms) => (clock += ms) };
}

test('token recusado deixa o selo nulo e avisa no log uma vez por pausa', async (t) => {
  t.after(() => mock.restoreAll());
  const fetch = mock.method(globalThis, 'fetch', async () =>
    new Response(JSON.stringify({ success: false, detail: 'Not authenticated' }), { status: 401 })
  );
  const { cacheStatus, lines, advance } = setup(torboxConfig);

  assert.deepEqual(await cacheStatus.lookup([HASH]), { [HASH]: null });
  assert.deepEqual(await cacheStatus.lookup([HASH]), { [HASH]: null });

  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /token do TorBox recusado/);

  advance(60 * 1000);
  await cacheStatus.lookup([HASH]);
  assert.equal(lines.length, 2);
});

test('sem provedor configurado nao pergunta nada nem avisa', async (t) => {
  t.after(() => mock.restoreAll());
  const fetch = mock.method(globalThis, 'fetch', async () => {
    throw new Error('nao deveria chamar');
  });
  const { cacheStatus, lines } = setup({ ...baseConfig, debrid: { provider: null, tokens: {} } });

  assert.deepEqual(await cacheStatus.lookup([HASH]), { [HASH]: null });
  assert.equal(fetch.mock.callCount(), 0);
  assert.deepEqual(lines, []);
});

test('erro inesperado ao montar o provedor sobe em vez de sumir', async () => {
  const { cacheStatus } = setup({ ...baseConfig, debrid: { provider: 'torbox' } });

  await assert.rejects(() => cacheStatus.lookup([HASH]), TypeError);
});
