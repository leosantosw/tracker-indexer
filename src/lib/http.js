'use strict';

const PERMANENT_STATUS = new Set([400, 401, 403, 404, 422]);

/** Sem isto o Node manda `undici`, que e o primeiro filtro de qualquer WAF. */
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

const HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Without the query string: it may carry a key (the TMDB `api_key`), and this message goes to the log. */
function safeUrl(url) {
  try {
    const { origin, pathname } = new URL(url);
    return origin + pathname;
  } catch {
    return String(url).split('?')[0];
  }
}

class HttpError extends Error {
  constructor(status, url) {
    super(`HTTP ${status} em ${safeUrl(url)}`);
    this.status = status;
    this.permanent = PERMANENT_STATUS.has(status);
  }
}

/**
 * Cliente por tracker: espaca as chamadas (rps) e repete erro transitorio com
 * backoff. Erro permanente nao e repetido -- o request e que esta errado.
 */
function createHttpClient({ rps = 2, timeoutMs = 20000, retries = 3, signal } = {}) {
  const minGapMs = 1000 / rps;
  let lastCallAt = 0;

  async function throttle() {
    const wait = minGapMs - (Date.now() - lastCallAt);
    if (wait > 0) await sleep(wait);
    lastCallAt = Date.now();
  }

  async function get(url, parse) {
    for (let attempt = 0; ; attempt++) {
      await throttle();

      try {
        const res = await fetch(url, {
          headers: HEADERS,
          signal: signal
            ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
            : AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) throw new HttpError(res.status, url);
        return await parse(res);
      } catch (err) {
        if (signal?.aborted || err.permanent || attempt >= retries) throw err;
        await sleep(500 * 2 ** attempt + Math.random() * 500);
      }
    }
  }

  return {
    getJson: (url) => get(url, (res) => res.json()),
    getText: (url) => get(url, (res) => res.text()),
  };
}

module.exports = { createHttpClient, HttpError, USER_AGENT };
