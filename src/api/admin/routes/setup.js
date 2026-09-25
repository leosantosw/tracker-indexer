'use strict';

const { SETUP_STATUS, SETUP } = require('../schemas');

function registerSetupRoutes(api, { store, currentToken }) {
  api.get('/setup', { schema: SETUP_STATUS }, async () => ({ required: !currentToken() }));

  api.post('/setup', { schema: SETUP }, async (request, reply) => {
    if (currentToken()) return reply.code(409).send({ error: 'o painel ja tem um token' });

    store.save({ secrets: { adminToken: request.body.token } });
    return reply.code(201).send({ ok: true });
  });
}

module.exports = { registerSetupRoutes };
