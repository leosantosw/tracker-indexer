'use strict';

const { UNMATCHED, CLEAR_UNMATCHED } = require('../schemas');

function registerUnmatchedRoutes(api, { repo, runner, log }) {
  api.get('/unmatched', { schema: UNMATCHED }, async (request) => {
    const { source = null, status = null, page, limit } = request.query;
    return { ...repo.listUnmatched({ source, status, page, limit }), page, limit, counts: repo.unmatchedCounts() };
  });

  api.delete('/unmatched', { schema: CLEAR_UNMATCHED }, async (request, reply) => {
    if (runner.status().running) {
      return reply.code(409).send({ error: 'espere o job atual terminar para apagar resultados' });
    }

    const { source = null, status = null } = request.query;
    const result = repo.clearUnmatched({ source, status });
    log(`sem match: ${result.removed} torrents de ${result.works} obras apagados pelo painel`);
    return result;
  });
}

module.exports = { registerUnmatchedRoutes };
