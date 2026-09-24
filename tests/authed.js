'use strict';

const baseConfig = require('../src/config');
const { buildServer } = require('../src/api/server');
const { createSettingsStore } = require('../src/settings');

const ADMIN_TOKEN = 'admin-token';
const API_TOKEN = 'tv-token';

async function buildAuthedServer(repo, { base = {}, ...options } = {}) {
  const store =
    options.store ??
    createSettingsStore(repo, {
      base: { ...baseConfig, admin: { token: ADMIN_TOKEN }, apps: { token: API_TOKEN }, ...base },
    });
  const app = await buildServer(repo, { ...options, store });

  const inject = app.inject.bind(app);
  app.inject = (request) => {
    const req = typeof request === 'string' ? { url: request } : request;
    if (req.headers && 'authorization' in req.headers) return inject(req);

    const url = req.url ?? req.path ?? '';
    const token = url.startsWith('/api/admin') ? (options.admin?.token ?? ADMIN_TOKEN) : API_TOKEN;
    return inject({ ...req, headers: { ...req.headers, authorization: `Bearer ${token}` } });
  };
  return app;
}

module.exports = { buildAuthedServer, ADMIN_TOKEN, API_TOKEN };
