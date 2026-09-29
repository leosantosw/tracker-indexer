'use strict';

const PAGE_DATA = /<script[^>]*data-page="app"[^>]*>([\s\S]*?)<\/script>/i;

class SessionError extends Error {}

function pageFromHtml(html) {
  const match = html.match(PAGE_DATA);
  if (!match) throw new SessionError('a página do tracker não trouxe os dados esperados: o layout do site pode ter mudado');
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
      throw new SessionError('cadastre o usuário e a senha do tracker na página dele');
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
    if (isLogin(res) || res.status >= 400) throw new SessionError('o tracker recusou o usuário ou a senha');
    loggedIn = true;
  }

  async function fetchPage(path) {
    const res = await send(path);
    if (isLogin(res)) return null;
    if (!res.ok) throw new SessionError(`o tracker respondeu HTTP ${res.status} em ${new URL(path, baseUrl).pathname}`);
    return pageFromHtml(await res.text());
  }

  async function page(path) {
    if (!loggedIn) await login();
    const first = await fetchPage(path);
    if (first) return first;

    loggedIn = false;
    await login();
    const retried = await fetchPage(path);
    if (!retried) throw new SessionError('o tracker recusou a sessão logo depois do login');
    return retried;
  }

  return { page };
}

module.exports = { createInertiaSession, SessionError, pageFromHtml };
