'use strict';

const { hidden, START_JOB } = require('../schemas');

function registerJobRoutes(api, { repo, runner, scheduler }) {
  api.get('/status', { schema: hidden({}) }, async () => ({
    job: runner.status(),
    schedule: scheduler.status(),
    stats: { sources: repo.stats(), works: repo.workStats(), types: repo.typeStats() },
  }));

  api.post('/jobs/:job', { schema: START_JOB }, async (request, reply) => {
    reply.code(202);
    return runner.start(request.params.job, request.body ?? {});
  });

  api.delete('/jobs/current', { schema: hidden({}) }, async () => runner.cancel());
}

module.exports = { registerJobRoutes };
