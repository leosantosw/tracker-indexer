'use strict';

const { createDebrid, DebridError } = require('../../debrid');
const { normalizeInfohash } = require('../../lib/infohash');
const { authorize } = require('../auth');
const { allowApps } = require('../cors');
const { RESOLVE, STATUS_ROUTE, REMOVE } = require('./schemas');

const FINAL = new Set(['ready', 'failed']);

/**
 * Debrid for the apps. Protected by API_TOKEN (these routes spend the paid
 * account and delete torrents), and never cached: a `ready` link expires, so
 * every call asks the provider for a fresh one.
 */
async function registerDebridApi(api, { store }) {
  const debrid = () => createDebrid(store.config());
  const hashOf = (request) => normalizeInfohash(request.body?.hash ?? request.params.hash);
  const wantOf = (request) => {
    const source = request.body ?? request.query ?? {};
    return { season: source.season ?? null, episode: source.episode ?? null };
  };

  await allowApps(api);
  api.addHook('onRequest', authorize(() => store.config().apps.token, 'API_TOKEN'));
  api.addHook('onSend', async (_request, reply) => {
    reply.header('cache-control', 'no-store');
  });

  api.setErrorHandler((err, _request, reply) => {
    if (err instanceof DebridError) return reply.code(err.statusCode).send({ error: err.message, code: err.code });
    if (err.validation) return reply.code(400).send({ error: err.message, code: 'invalid_request' });
    reply.send(err);
  });

  api.post('/torrents', { schema: RESOLVE }, async (request, reply) => {
    const result = await debrid().resolve(hashOf(request), wantOf(request));
    return reply.code(FINAL.has(result.status) ? 200 : 202).send(result);
  });

  api.get('/torrents/:hash', { schema: STATUS_ROUTE }, async (request) => debrid().status(hashOf(request), wantOf(request)));

  api.delete('/torrents/:hash', { schema: REMOVE }, async (request) => debrid().remove(hashOf(request)));
}

module.exports = { registerDebridApi };
