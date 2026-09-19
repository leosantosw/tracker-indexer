'use strict';

const { PROVIDERS } = require('../debrid');
const { SettingsError } = require('./errors');

/** One token per debrid provider, named by the provider itself (e.g. `torboxToken`). */
const debridSlots = Object.fromEntries(
  PROVIDERS.map(({ id, secret }) => [
    secret,
    {
      read: (config) => config.debrid.tokens[id],
      apply: (config, value) => ({
        ...config,
        debrid: { ...config.debrid, tokens: { ...config.debrid.tokens, [id]: value } },
      }),
    },
  ])
);

/** Secrets the panel may set, and where each one lands in the config. */
const SLOTS = {
  tmdbApiKey: {
    read: (config) => config.tmdb.apiKey,
    apply: (config, value) => ({ ...config, tmdb: { ...config.tmdb, apiKey: value } }),
  },
  adminToken: {
    read: (config) => config.admin.token,
    apply: (config, value) => ({ ...config, admin: { ...config.admin, token: value } }),
  },
  apiToken: {
    read: (config) => config.apps.token,
    apply: (config, value) => ({ ...config, apps: { ...config.apps, token: value } }),
  },
  ...debridSlots,
};

const NAMES = Object.keys(SLOTS);

// Bound as associated data: a ciphertext only opens in its own slot.
const context = (name) => `setting:secrets:${name}`;

/** Undecryptable values are skipped, so the env value (if any) still applies. */
function openSecrets(stored = {}, cipher) {
  const values = {};
  const errors = {};

  for (const name of NAMES.filter((slot) => slot in stored)) {
    if (!cipher) {
      errors[name] = 'SECRETS_KEY ausente: o valor salvo no painel foi ignorado';
      continue;
    }
    try {
      values[name] = cipher.decrypt(stored[name], context(name));
    } catch {
      errors[name] = 'nao foi possivel decifrar: a SECRETS_KEY mudou?';
    }
  }
  return { values, errors };
}

const applySecrets = (config, values) =>
  Object.entries(values).reduce((acc, [name, value]) => SLOTS[name].apply(acc, value), config);

/** Where each secret comes from -- never the value itself. */
function secretsStatus(base, { values, errors }, cipher) {
  const source = (name) => (name in values ? 'panel' : SLOTS[name].read(base) ? 'env' : null);

  return {
    encryption: Boolean(cipher),
    ...Object.fromEntries(NAMES.map((name) => [name, { source: source(name), error: errors[name] ?? null }])),
  };
}

/** A string encrypts and stores; null removes the panel value, falling back to env. */
function sealSecrets(stored = {}, patch, cipher) {
  const next = { ...stored };

  for (const [name, value] of Object.entries(patch)) {
    if (value === null) {
      delete next[name];
      continue;
    }
    if (!cipher) throw new SettingsError('defina SECRETS_KEY no .env para salvar segredos pelo painel');
    next[name] = cipher.encrypt(value, context(name));
  }
  return next;
}

module.exports = { openSecrets, applySecrets, secretsStatus, sealSecrets };
