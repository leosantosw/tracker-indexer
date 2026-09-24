'use strict';

const { HEALTH, STATS } = require('./schemas');
const { registerCatalogs } = require('./catalog');
const { registerCategories } = require('./categories');
const { allowApps } = require('../cors');

/** The read-only API: service routes plus the movie and series catalogs. */
async function registerPublicApi(api, { repo, store, cacheStatus }) {
  await allowApps(api);

  // Cache it, but ask every time: the ETag turns an unchanged catalog into a 304.
  api.addHook('onSend', async (request, reply) => {
    if (request.method === 'GET') reply.header('cache-control', 'no-cache');
  });

  api.get('/health', { schema: HEALTH }, async () => ({ status: 'ok' }));

  api.get('/stats', { schema: STATS }, async () => ({
    sources: repo.stats(),
    works: repo.workStats(),
  }));

  registerCategories(api, { repo, store });
  registerCatalogs(api, { repo, store, cacheStatus });
}

module.exports = { registerPublicApi };
