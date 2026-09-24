'use strict';

const { HEALTH, STATS } = require('./schemas');
const { registerCatalogs } = require('./catalog');
const { registerCategories } = require('./categories');
const { registerSearch } = require('./search');
const { authorize } = require('../auth');
const { allowApps } = require('../cors');

/** The read-only API: service routes, the movie and series catalogs and the search. */
async function registerPublicApi(api, { repo, store, cacheStatus }) {
  await allowApps(api);

  // Cache it, but ask every time: the ETag turns an unchanged catalog into a 304.
  api.addHook('onSend', async (request, reply) => {
    if (request.method === 'GET') reply.header('cache-control', 'no-cache');
  });

  api.get('/health', { schema: HEALTH }, async () => ({ status: 'ok' }));

  await api.register(async (scoped) => {
    scoped.addHook('onRequest', authorize(() => store.config().apps.token, 'API_TOKEN'));

    scoped.get('/stats', { schema: STATS }, async () => ({
      sources: repo.stats(),
      works: repo.workStats(),
      tmdb: { configured: Boolean(store.config().tmdb.apiKey) },
    }));

    registerCategories(scoped, { repo, store });
    registerCatalogs(scoped, { repo, store, cacheStatus });
    registerSearch(scoped, { repo, store });
  });
}

module.exports = { registerPublicApi };
