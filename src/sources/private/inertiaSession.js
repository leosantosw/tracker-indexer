'use strict';

const { PrivateSourceError } = require('./errors');

const PAGE_DATA = /<script[^>]*data-page="app"[^>]*>([\s\S]*?)<\/script>/i;

const TORRENT_FILE = /bittorrent|octet-stream/i;

function pageFromHtml(html) {
  const match = html.match(PAGE_DATA);
  if (!match) throw new PrivateSourceError('unavailable', 'a página do tracker não trouxe os dados esperados: o layout do site pode ter mudado');
  return JSON.parse(match[1]);
}

function createCookieJar() {
  const cookies = new Map();
  return {
    keep(res) {
      for (const cookie of res.headers.getSetCookie?.() ?? []) {
        const [pair] = cookie.split(';');
        const eq = pair.indexOf('=');
        cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1));
      }
    },
    header: () => [...cookies].map(([name, value]) => `${name}=${value}`).join('; '),
    get: (name) => cookies.get(name),
    clear: () => cookies.clear(),
  };
}

function createInertiaSession({ baseUrl, http, credentials = {}, loginPath = '/login' }) {
  const jar = createCookieJar();
  let loggedIn = false;

  const isLogin = (res) => {
    if (res.status === 401 || res.status === 419) return true;
    const location = res.headers.get('location');
    return res.status >= 300 && res.status < 400 && location !== null && new URL(location, baseUrl).pathname === loginPath;
  };

  async function send(path, init = {}) {
    const res = await http.send(new URL(path, baseUrl), { ...init, headers: { ...init.headers, Cookie: jar.header() } });
    jar.keep(res);
    return res;
  }

  async function login() {
    if (!credentials.username || !credentials.password) {
      throw new PrivateSourceError('login', 'cadastre o usuário e a senha do tracker na página dele');
    }
    jar.clear();
    const form = await send(loginPath);
    const { version } = pageFromHtml(await form.text());

    const res = await send(loginPath, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/html, application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-Inertia': 'true',
        'X-Inertia-Version': version ?? '',
        'X-XSRF-TOKEN': decodeURIComponent(jar.get('XSRF-TOKEN') ?? ''),
      },
      body: JSON.stringify({ username: credentials.username, password: credentials.password, remember: false }),
    });
    if (isLogin(res) || res.status >= 400) throw new PrivateSourceError('login', 'o tracker recusou o usuário ou a senha');
    loggedIn = true;
  }

  function refused(res, path) {
    const where = new URL(path, baseUrl).pathname;
    if (res.status === 404) return new PrivateSourceError('gone', `o tracker não tem mais ${where}`);
    return new PrivateSourceError('unavailable', `o tracker respondeu HTTP ${res.status} em ${where}`);
  }

  async function loggedGet(path) {
    if (!loggedIn) await login();
    const first = await send(path);
    if (!isLogin(first)) return first;

    loggedIn = false;
    await login();
    const retried = await send(path);
    if (isLogin(retried)) throw new PrivateSourceError('login', 'o tracker recusou a sessão logo depois do login');
    return retried;
  }

  async function page(path) {
    const res = await loggedGet(path);
    if (!res.ok) throw refused(res, path);
    return pageFromHtml(await res.text());
  }

  async function file(path) {
    const res = await loggedGet(path);
    if (!res.ok) throw refused(res, path);
    if (!TORRENT_FILE.test(res.headers.get('content-type') ?? '')) {
      throw new PrivateSourceError('unavailable', 'o tracker não entregou um arquivo .torrent');
    }
    return Buffer.from(await res.arrayBuffer());
  }

  return { page, file };
}

module.exports = { createInertiaSession, pageFromHtml };
