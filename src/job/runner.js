'use strict';

class JobError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

const OUTCOME_LABEL = { done: 'concluido', skipped: 'pulado', cancelled: 'cancelado', failed: 'falhou' };

const iso = (ms) => new Date(ms).toISOString();

// Progress arrives per page and per TMDB work: the panel hears it at most this often.
const PROGRESS_EVERY_MS = 250;

/**
 * Runs one job at a time in the background. `jobs` maps a name to an async
 * function receiving `{ signal, ...options }`; `onChange` gets every new state.
 *
 * A job may resolve to `{ skipped, reason }`: `skipped` turns the result
 * into "skipped" instead of "done", and `reason` travels as a code.
 *
 * Jobs also get `report(progress)`: the latest snapshot rides along in the
 * status while running and stays in `last` as the run's summary.
 */
function createRunner({ jobs, log, onChange = () => {} }) {
  let current = null;
  let last = null;
  let pendingNotify = null;

  const status = () => ({
    running: current && {
      job: current.job,
      options: current.options,
      startedAt: iso(current.startedAt),
      cancelling: current.controller.signal.aborted,
      progress: current.progress,
    },
    last,
  });

  const notify = () => {
    clearTimeout(pendingNotify);
    pendingNotify = null;
    onChange(status());
  };

  const notifySoon = () => {
    pendingNotify ??= setTimeout(notify, PROGRESS_EVERY_MS);
    pendingNotify.unref?.();
  };

  async function execute(job) {
    let outcome;
    try {
      const report = (progress) => {
        job.progress = progress;
        notifySoon();
      };
      const { skipped, reason } = (await jobs[job.job]({ ...job.options, signal: job.controller.signal, report })) ?? {};
      outcome = { result: skipped ? 'skipped' : 'done', reason: reason ?? null, error: null };
    } catch (err) {
      const cancelled = job.controller.signal.aborted;
      outcome = { result: cancelled ? 'cancelled' : 'failed', reason: null, error: cancelled ? null : err.message };
    }

    log(`${job.job}: ${OUTCOME_LABEL[outcome.result]}${outcome.error ? ` -- ${outcome.error}` : ''}`);
    last = { job: job.job, startedAt: iso(job.startedAt), finishedAt: iso(Date.now()), ...outcome, progress: job.progress };
    current = null;
    notify();
  }

  function start(job, options = {}) {
    if (!Object.hasOwn(jobs, job)) throw new JobError(`job desconhecido: ${job}`, 404);
    if (current) throw new JobError(`${current.job} ja esta rodando`, 409);

    current = { job, options, startedAt: Date.now(), controller: new AbortController(), progress: null };
    log(`${job}: iniciado`);
    notify();
    current.done = execute(current);
    return status();
  }

  function cancel() {
    if (!current) throw new JobError('nenhum job rodando', 409);
    if (!current.controller.signal.aborted) {
      current.controller.abort();
      log(`${current.job}: cancelando...`);
      notify();
    }
    return status();
  }

  /** Resolves when the running job settles; used by tests and shutdown. */
  const idle = () => current?.done ?? Promise.resolve();

  return { start, cancel, status, idle };
}

module.exports = { createRunner, JobError };
