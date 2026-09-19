'use strict';

const fastify = require('fastify');
const compress = require('@fastify/compress');
const etag = require('@fastify/etag');

const { createSettingsStore } = require('../settings');
const { SHARED } = require('./public/schemas');
const { registerDocs } = require('./public/docs');
const { registerPublicApi } = require('./public');
const { registerDebridApi } = require('./debrid');
const { registerAdmin } = require('./admin');

const API_PREFIX = '/api';

/**
 * Everything the server exposes: the public API and its docs under /api, the
 * debrid routes under /api/debrid, the admin API under /api/admin and the
 * panel at /admin.
 *
 * Responses go out compressed (br/gzip) and with an ETag, so a client that
 * already has the page gets an empty 304 until the catalog changes.
 *
 * `options.store` replaces the settings store (tests); `options.admin` goes to
 * the admin panel: token, echo and job overrides.
 */
async function buildServer(repo, options = {}) {
  const app = fastify();
  const deps = { repo, store: options.store ?? createSettingsStore(repo) };

  await app.register(compress);
  await app.register(etag);

  for (const schema of SHARED) app.addSchema(schema);
  await registerDocs(app, `${API_PREFIX}/docs`);

  await app.register(async (api) => registerPublicApi(api, deps), { prefix: API_PREFIX });
  await app.register(async (api) => registerDebridApi(api, deps), { prefix: `${API_PREFIX}/debrid` });
  await registerAdmin(app, deps, { ...options.admin, apiPrefix: `${API_PREFIX}/admin` });

  return app;
}

module.exports = { buildServer };
