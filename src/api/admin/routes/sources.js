'use strict';

const { CLEAR_SOURCE } = require('../schemas');

/**
 * Wipes one tracker's torrents. Refused while a job runs: a sync writing the
 * same rows would bring part of them right back.
 */
function registerSourceRoutes(api, { repo, store, runner, log }) {
  api.delete('/sources/:name/items', { schema: CLEAR_SOURCE }, async (request, reply) => {
    const { name } = request.params;

    if (!store.config().sources.some((source) => source.name === name)) {
      return reply.code(404).send({ error: `tracker desconhecido: ${name}` });
    }
    if (runner.status().running) {
      return reply.code(409).send({ error: 'espere o job atual terminar para apagar resultados' });
    }

    const removed = repo.clearSource(name);
    log(`${name}: ${removed} torrents apagados pelo painel`);
    return { source: name, removed };
  });
}

module.exports = { registerSourceRoutes };
