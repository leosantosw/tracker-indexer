'use strict';

const { DebridError } = require('../errors');

const BASE_URL = 'https://api.torbox.app/v1/api';

/** TorBox answers `{ success, detail, error, data }`; the detail is safe to show. */
function toError(status, payload) {
  const detail = String(payload?.detail ?? payload?.error ?? '').slice(0, 200);

  if (status === 401 || status === 403) return new DebridError('token do TorBox recusado', 502, 'provider_auth');
  if (status === 429) {
    return new DebridError('limite de requisicoes do TorBox atingido; tente de novo em instantes', 429, 'provider_rate_limit');
  }
  return new DebridError(`TorBox recusou o pedido${detail ? `: ${detail}` : ''}`, 502, 'provider_error');
}

/**
 * Thin client over the TorBox endpoints this app needs. Auth goes in the
 * Authorization header -- except `requestdl`, which only takes it as `token`
 * in the query. Neither URL nor token ever leaves this module in an error.
 */
function createTorboxApi({ token, timeoutMs = 20000, fetch = globalThis.fetch }) {
  async function call(method, path, { query = {}, form, json, tokenInQuery = false } = {}) {
    const url = new URL(BASE_URL + path);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
    if (tokenInQuery) url.searchParams.set('token', token);

    const headers = { Accept: 'application/json' };
    if (!tokenInQuery) headers.Authorization = `Bearer ${token}`;

    let body;
    if (json) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(json);
    } else if (form) {
      body = new FormData();
      for (const [key, value] of Object.entries(form)) body.append(key, String(value));
    }

    let res;
    try {
      res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(timeoutMs) });
    } catch {
      throw new DebridError('TorBox fora do ar ou lento demais', 504, 'provider_unavailable');
    }

    const payload = await res.json().catch(() => null);
    if (!res.ok || payload?.success === false) throw toError(res.status, payload);
    return payload?.data ?? null;
  }

  return {
    /** Whole list, freshly read: TorBox caches it for up to 10 minutes otherwise. */
    async findByHash(hash) {
      const list = await call('GET', '/torrents/mylist', { query: { bypass_cache: true } });
      return (list ?? []).find((torrent) => String(torrent.hash).toLowerCase() === hash) ?? null;
    },

    getTorrent: (id) => call('GET', '/torrents/mylist', { query: { id, bypass_cache: true } }),

    async isCached(hash) {
      const data = await call('GET', '/torrents/checkcached', { query: { hash, format: 'object' } });
      return Boolean(data?.[hash]);
    },

    createTorrent: (magnet) => call('POST', '/torrents/createtorrent', { form: { magnet, allow_zip: false } }),

    /** A fresh CDN link. It expires, so it is requested on every call and never stored. */
    requestLink: (torrentId, fileId) =>
      call('GET', '/torrents/requestdl', {
        query: { torrent_id: torrentId, file_id: fileId, zip_link: false, redirect: false },
        tokenInQuery: true,
      }),

    control: (torrentId, operation) =>
      call('POST', '/torrents/controltorrent', { json: { torrent_id: torrentId, operation } }),
  };
}

module.exports = { createTorboxApi };
