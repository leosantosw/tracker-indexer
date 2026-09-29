'use strict';

const { createRunner } = require('../../job/runner');
const { createScheduler } = require('../../job/scheduler');
const { runSync, runEnrich } = require('../../job/pipeline');
const { authorize } = require('../auth');
const { registerJobRoutes } = require('./routes/jobs');
const { registerSettingsRoutes } = require('./routes/settings');
const { registerSourceRoutes } = require('./routes/sources');
const { registerEventRoutes } = require('./routes/events');
const { registerUiRoutes } = require('./routes/ui');
const { registerSetupRoutes } = require('./routes/setup');
const { registerUnmatchedRoutes } = require('./routes/unmatched');
const { registerManualMatchRoutes } = require('./routes/manualMatch');

const LAST_RUN = 'lastRun';

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
async function registerAdmin(app, { repo, store, feed, log }, { apiPrefix, token, jobs, uiDir } = {}) {
  const currentToken = () => (token !== undefined ? token : store.config().admin.token);

  const runner = createRunner({
    jobs: jobs ?? pipelineJobs({ repo, store }, log),
    log,
    onChange: (status) => feed.publish('status', status),
    last: repo.readState(LAST_RUN),
    onSettle: (last) => repo.writeState(LAST_RUN, last),
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

  registerUiRoutes(app, { dir: uiDir });

  await app.register(async (api) => registerSetupRoutes(api, { store, currentToken }), { prefix: apiPrefix });

  await app.register(
    async (api) => {
      api.addHook('onRequest', authorize(currentToken, 'ADMIN_TOKEN'));
      registerJobRoutes(api, { repo, runner, scheduler });
      registerSettingsRoutes(api, { store });
      registerSourceRoutes(api, { repo, store, runner, log });
      registerUnmatchedRoutes(api, { repo, runner, log });
      registerManualMatchRoutes(api, { repo, store, log });
      registerEventRoutes(api, { feed, runner, scheduler });
    },
    { prefix: apiPrefix }
  );

  return runner;
}

module.exports = { registerAdmin };
