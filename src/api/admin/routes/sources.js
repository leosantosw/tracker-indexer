'use strict';

const { CLEAR_SOURCE } = require('../schemas');
const { createSources } = require('../../../sources');
const { inspectSource } = require('../../../job/checkSource');

/**
 * Wipes one tracker's torrents. Refused while a job runs: a sync writing the
 * same rows would bring part of them right back.
 *
 * `check` is `npm run check-source` for the panel: reads the first page,
 * saves nothing, and stops if the panel gives up waiting.
 */
function registerSourceRoutes(api, { repo, store, runner, log }) {
  api.post('/sources/:name/check', { schema: CLEAR_SOURCE }, async (request, reply) => {
    const { name } = request.params;
    const controller = new AbortController();
    reply.raw.on('close', () => controller.abort());

    const source = createSources(store.config(), { signal: controller.signal, includeDisabled: true }).find(
      (item) => item.name === name
    );
    if (!source) return reply.code(404).send({ error: `tracker desconhecido: ${name}` });

    try {
      return await inspectSource(source);
    } catch (err) {
      log(`${name}: teste falhou -- ${err.message}`);
      return reply.code(502).send({ error: `não foi possível ler o tracker: ${err.message}` });
    }
  });

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
