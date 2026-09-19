'use strict';

const { nextRun, describeSchedule } = require('./schedule');

/**
 * Runs the catalog update (sync, which ends with enrich) on the schedule saved
 * in the panel. Re-arms whenever the settings change and after every run, so
 * an interval counts from the end of the previous run and never piles up.
 */
function createScheduler({ store, runner, log, onChange = () => {}, timers = globalThis, now = () => new Date() }) {
  let timer = null;
  let next = null;

  const status = () => {
    const schedule = store.config().schedule;
    return {
      enabled: Boolean(schedule?.enabled),
      description: describeSchedule(schedule),
      nextRunAt: next ? next.toISOString() : null,
    };
  };

  function arm() {
    timers.clearTimeout(timer);
    timer = null;
    next = nextRun(store.config().schedule, now());

    if (next) {
      timer = timers.setTimeout(fire, Math.max(0, next.getTime() - now().getTime()));
      timer?.unref?.();
    }
    onChange(status());
  }

  async function fire() {
    timer = null;

    if (runner.status().running) {
      log('agendamento: ja havia uma execucao rodando, a agendada foi pulada');
      return arm();
    }

    log(`agendamento: iniciando a atualizacao do catalogo (${describeSchedule(store.config().schedule)})`);
    try {
      runner.start('sync', {});
      await runner.idle();
    } catch (err) {
      log(`agendamento: ${err.message}`);
    }
    arm();
  }

  const unsubscribe = store.onChange(arm);
  arm();

  function stop() {
    timers.clearTimeout(timer);
    timer = null;
    unsubscribe();
  }

  return { status, stop };
}

module.exports = { createScheduler };
