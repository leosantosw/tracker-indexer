'use strict';

const { DebridError } = require('./errors');

/**
 * Debrid providers. To add one: create its folder with the same contract and
 * list it here, plus its token in `config.debrid.tokens`.
 *
 * Contract: { id, label, secret, create({ token, timeoutMs }) -> { resolve, status, remove, checkCached } }
 * where resolve/status/remove take a lowercase hex infohash and return
 *   { status: 'ready', url, file } | { status: 'downloading', progress, eta, state }
 *   | { status: 'queued' } | { status: 'failed', reason }
 * and checkCached(hashes) returns { [hash]: boolean } without adding anything.
 * resolve also takes `{ torrentFile }`: for a private torrent, an async function
 * giving the .torrent bytes, called only when the hash is not cached.
 * `cacheBatch` is how many hashes one checkCached call takes; a provider
 * without a cache lookup leaves it out and the cache check is skipped.
 */
const PROVIDERS = [require('./torbox')];

const BY_ID = new Map(PROVIDERS.map((provider) => [provider.id, provider]));

const PROVIDER_IDS = PROVIDERS.map((provider) => provider.id);

/** What the panel needs to draw the select and the token field. */
const providerOptions = () => PROVIDERS.map(({ id, label, secret, cacheBatch }) => ({ id, label, secret, cacheBatch: cacheBatch ?? null }));

const providerOf = (config) => BY_ID.get(config.debrid.provider) ?? null;

function createDebrid(config, options = {}) {
  const provider = BY_ID.get(config.debrid.provider);
  if (!provider) throw new DebridError('nenhum provedor de debrid configurado', 503, 'not_configured');

  const token = config.debrid.tokens[provider.id];
  if (!token) throw new DebridError(`falta o token do ${provider.label}`, 503, 'missing_token');

  return provider.create({ token, timeoutMs: config.http.timeoutMs, ...options });
}

module.exports = { PROVIDERS, PROVIDER_IDS, providerOptions, providerOf, createDebrid, DebridError };
