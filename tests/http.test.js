'use strict';

const { test, mock } = require('node:test');
const assert = require('node:assert');

const { createHttpClient, USER_AGENT } = require('../src/lib/http');

const client = () => createHttpClient({ rps: 1000, retries: 2 });

test('send devolve o redirecionamento sem segui-lo e mistura os cabeçalhos', async (t) => {
  t.after(() => mock.restoreAll());
  const fetch = mock.method(globalThis, 'fetch', async () => new Response(null, { status: 302, headers: { location: '/login' } }));

  const res = await client().send('https://site.test/torrents', { headers: { 'X-Test': '1' } });

  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/login');
  const [, init] = fetch.mock.calls[0].arguments;
  assert.equal(init.redirect, 'manual');
  assert.equal(init.headers['User-Agent'], USER_AGENT);
  assert.equal(init.headers['X-Test'], '1');
});

test('send tenta de novo em erro 5xx e para no primeiro sucesso', async (t) => {
  t.after(() => mock.restoreAll());
  let calls = 0;
  mock.method(globalThis, 'fetch', async () => (++calls === 1 ? new Response('', { status: 503 }) : new Response('ok')));
  mock.method(globalThis, 'setTimeout', (fn) => {
    fn();
    return 0;
  });

  const res = await client().send('https://site.test/');

  assert.equal(res.status, 200);
  assert.equal(calls, 2);
});

test('send não repete 4xx: quem decide o que fazer é quem chamou', async (t) => {
  t.after(() => mock.restoreAll());
  const fetch = mock.method(globalThis, 'fetch', async () => new Response('', { status: 419 }));

  const res = await client().send('https://site.test/');

  assert.equal(res.status, 419);
  assert.equal(fetch.mock.callCount(), 1);
});
