'use strict';

const { hidden, SETTINGS_PATCH } = require('../schemas');

/**
 * Plain settings apply to the next run; secrets and `minVotes` to the next
 * request. The view never carries a secret value, only where it comes from.
 */
function registerSettingsRoutes(api, { store }) {
  api.get('/settings', { schema: hidden({}) }, async () => store.view());

  api.put('/settings', { schema: SETTINGS_PATCH }, async (request) => {
    store.save(request.body);
    return store.view();
  });

  api.delete('/settings', { schema: hidden({}) }, async () => {
    store.reset();
    return store.view();
  });
}

module.exports = { registerSettingsRoutes };
