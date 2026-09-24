'use strict';

const { isLocal } = require('../../auth');
const { SETUP_STATUS, SETUP } = require('../schemas');

function registerSetupRoutes(api, { store, currentToken }) {
  api.get('/setup', { schema: SETUP_STATUS }, async (request) => ({
    required: !currentToken(),
    allowed: isLocal(request),
  }));

  api.post('/setup', { schema: SETUP }, async (request, reply) => {
    if (currentToken()) return reply.code(409).send({ error: 'o painel ja tem um token' });
    if (!isLocal(request)) return reply.code(403).send({ error: 'o primeiro token so pode ser criado em localhost' });

    store.save({ secrets: { adminToken: request.body.token } });
    return reply.code(201).send({ ok: true });
  });
}

module.exports = { registerSetupRoutes };
