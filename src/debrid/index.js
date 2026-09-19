'use strict';

const { DebridError } = require('./errors');

/**
 * Debrid providers. To add one: create its folder with the same contract and
 * list it here, plus its token in `config.debrid.tokens`.
 *
 * Contract: { id, label, secret, create({ token, timeoutMs }) -> { resolve, status, remove } }
 * where every method takes a lowercase hex infohash and returns
 *   { status: 'ready', url, file } | { status: 'downloading', progress, eta, state }
 *   | { status: 'queued' } | { status: 'failed', reason }
 */
const PROVIDERS = [require('./torbox')];

const BY_ID = new Map(PROVIDERS.map((provider) => [provider.id, provider]));

const PROVIDER_IDS = PROVIDERS.map((provider) => provider.id);

/** What the panel needs to draw the select and the token field. */
const providerOptions = () => PROVIDERS.map(({ id, label, secret }) => ({ id, label, secret }));

function createDebrid(config, options = {}) {
  const provider = BY_ID.get(config.debrid.provider);
  if (!provider) throw new DebridError('nenhum provedor de debrid configurado', 503, 'not_configured');

  const token = config.debrid.tokens[provider.id];
  if (!token) throw new DebridError(`falta o token do ${provider.label}`, 503, 'missing_token');

  return provider.create({ token, timeoutMs: config.http.timeoutMs, ...options });
}

module.exports = { PROVIDERS, PROVIDER_IDS, providerOptions, createDebrid, DebridError };
