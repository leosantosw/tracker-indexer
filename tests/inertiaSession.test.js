'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const { createInertiaSession } = require('../src/sources/private/inertiaSession');

const BASE = 'https://site.test';

const pageHtml = (page) => `<html><body><script data-page="app" type="application/json">${JSON.stringify(page)}</script></body></html>`;

function fakeSite({ password = 'certa', expireAfter = Infinity } = {}) {
  const calls = [];
  let sessionId = 0;
  let loggedIn = null;
  let served = 0;

  async function send(url, init = {}) {
    const { pathname } = new URL(url);
    const cookies = init.headers?.Cookie ?? '';
    calls.push({ method: init.method ?? 'GET', pathname, cookies, xsrf: init.headers?.['X-XSRF-TOKEN'] });

    if (pathname === '/login' && (init.method ?? 'GET') === 'GET') {
      sessionId++;
      return new Response(pageHtml({ component: 'auth/login', props: {} }), {
        headers: [['set-cookie', `XSRF-TOKEN=tok${sessionId}%3D; path=/`], ['set-cookie', `app_session=s${sessionId}; path=/`]],
      });
    }
    if (pathname === '/login') {
      const body = JSON.parse(init.body);
      if (body.password !== password) return new Response(null, { status: 302, headers: { location: `${BASE}/login` } });
      loggedIn = `app_session=s${sessionId}`;
      served = 0;
      return new Response(null, { status: 302, headers: { location: `${BASE}/dashboard`, 'set-cookie': `${loggedIn}; path=/` } });
    }
    if (!loggedIn || !cookies.includes(loggedIn) || served >= expireAfter) {
      loggedIn = null;
      return new Response(null, { status: 302, headers: { location: `${BASE}/login` } });
    }
    served++;
    return new Response(pageHtml({ component: 'torrents/index', props: { path: pathname } }));
  }

  return { send, calls };
}

test('faz login na primeira página e manda o cookie e o CSRF certos', async () => {
  const site = fakeSite();
  const session = createInertiaSession({ baseUrl: BASE, http: site, credentials: { username: 'leo', password: 'certa' } });

  const page = await session.page('/torrents?page=1');

  assert.equal(page.component, 'torrents/index');
  const post = site.calls.find((call) => call.method === 'POST');
  assert.equal(post.xsrf, 'tok1=', 'o XSRF-TOKEN do cookie vai decodificado no cabeçalho');
  assert.match(site.calls.at(-1).cookies, /app_session=s1/);
});

test('reaproveita a sessão entre páginas: um login só', async () => {
  const site = fakeSite();
  const session = createInertiaSession({ baseUrl: BASE, http: site, credentials: { username: 'leo', password: 'certa' } });

  await session.page('/torrents?page=1');
  await session.page('/torrents?page=2');

  assert.equal(site.calls.filter((call) => call.method === 'POST').length, 1);
});

test('sessão que cai no meio é refeita uma vez e a página é pedida de novo', async () => {
  const site = fakeSite({ expireAfter: 1 });
  const session = createInertiaSession({ baseUrl: BASE, http: site, credentials: { username: 'leo', password: 'certa' } });

  await session.page('/torrents?page=1');
  const page = await session.page('/torrents?page=2');

  assert.equal(page.props.path, '/torrents');
  assert.equal(site.calls.filter((call) => call.method === 'POST').length, 2);
});

test('senha errada vira erro claro, sem tentar de novo em ciclo', async () => {
  const site = fakeSite({ password: 'outra' });
  const session = createInertiaSession({ baseUrl: BASE, http: site, credentials: { username: 'leo', password: 'certa' } });

  await assert.rejects(() => session.page('/torrents'), /usuário ou a senha/);
  assert.equal(site.calls.filter((call) => call.method === 'POST').length, 1);
});

test('sem usuário e senha nem tenta entrar', async () => {
  const site = fakeSite();
  const session = createInertiaSession({ baseUrl: BASE, http: site, credentials: {} });

  await assert.rejects(() => session.page('/torrents'), /cadastre o usuário e a senha/);
  assert.equal(site.calls.length, 0);
});

test('se o site derruba a sessão logo depois do login, desiste em vez de insistir', async () => {
  const site = fakeSite({ expireAfter: 0 });
  const session = createInertiaSession({ baseUrl: BASE, http: site, credentials: { username: 'leo', password: 'certa' } });

  await assert.rejects(() => session.page('/torrents'), /recusou a sessão/);
  assert.equal(site.calls.filter((call) => call.method === 'POST').length, 2);
});
