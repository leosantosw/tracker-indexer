'use strict';

const { createFeed } = require('../../lib/feed');
const { createRunner } = require('../../job/runner');
const { createScheduler } = require('../../job/scheduler');
const { runSync, runEnrich } = require('../../job/pipeline');
const { authorize } = require('../auth');
const { registerJobRoutes } = require('./routes/jobs');
const { registerSettingsRoutes } = require('./routes/settings');
const { registerSourceRoutes } = require('./routes/sources');
const { registerEventRoutes } = require('./routes/events');
const { registerUiRoutes } = require('./routes/ui');

/** Each run reads the current config, so what was saved in the panel takes effect. */
const pipelineJobs = ({ repo, store }, log) => ({
  sync: ({ signal, sources, report }) => runSync({ repo, config: store.config(), log, signal, only: sources, report }),
  enrich: ({ signal, report }) => runEnrich({ repo, config: store.config(), log, signal, report }),
});

/**
 * Admin panel: the UI at /admin and its API under `apiPrefix`. Job output goes
 * to the terminal and to the live feed, never to disk. The token is read per
 * request, so changing it in the panel applies at once; `token` pins it (tests).
 */
async function registerAdmin(app, { repo, store }, { apiPrefix, token, echo = console.log, jobs } = {}) {
  const feed = createFeed();
  const log = (message) => echo(`${feed.log(message).at} ${message}`);
  const currentToken = () => (token !== undefined ? token : store.config().admin.token);

  const runner = createRunner({
    jobs: jobs ?? pipelineJobs({ repo, store }, log),
    log,
    onChange: (status) => feed.publish('status', status),
  });

  const scheduler = createScheduler({
    store,
    runner,
    log,
    onChange: (status) => feed.publish('schedule', status),
  });

  app.addHook('onClose', async () => {
    scheduler.stop();
    if (runner.status().running) runner.cancel();
    await runner.idle();
  });

  registerUiRoutes(app);

  await app.register(
    async (api) => {
      api.addHook('onRequest', authorize(currentToken, 'ADMIN_TOKEN'));
      registerJobRoutes(api, { repo, runner, scheduler });
      registerSettingsRoutes(api, { store });
      registerSourceRoutes(api, { repo, store, runner, log });
      registerEventRoutes(api, { feed, runner, scheduler });
    },
    { prefix: apiPrefix }
  );

  return runner;
}

module.exports = { registerAdmin };
