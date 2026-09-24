'use strict';

const { nextRun, describeSchedule } = require('./schedule');

const MAX_WAIT_MS = 60 * 1000;
const RETRY_MS = 60 * 1000;

/**
 * Runs the catalog update (sync, which ends with enrich) on the schedule saved
 * in the panel. Re-arms whenever the settings change and after every run, so
 * an interval counts from the end of the previous run and never piles up.
 */
function createScheduler({ store, runner, log, onChange = () => {}, timers = globalThis, now = () => new Date() }) {
  let timer = null;
  let next = null;
  let armedFor = null;
  let stopped = false;

  const schedule = () => store.config().schedule;

  const status = () => ({
    enabled: Boolean(schedule()?.enabled),
    description: describeSchedule(schedule()),
    nextRunAt: next ? next.toISOString() : null,
  });

  function clear() {
    timers.clearTimeout(timer);
    timer = null;
  }

  function wait(ms) {
    clear();
    if (stopped) return;
    timer = timers.setTimeout(tick, Math.min(Math.max(0, ms), MAX_WAIT_MS));
    timer?.unref?.();
  }

  function safely(step) {
    try {
      return step();
    } catch (err) {
      log(`agendamento: ${err.message} -- tentando de novo em 1 minuto`);
      next = null;
      armedFor = null;
      wait(RETRY_MS);
    }
  }

  const arm = () =>
    safely(() => {
      armedFor = JSON.stringify(schedule());
      next = nextRun(schedule(), now());
      if (next) wait(next.getTime() - now().getTime());
      else clear();
      onChange(status());
    });

  const tick = () =>
    safely(() => {
      timer = null;
      if (!next) return arm();
      const remaining = next.getTime() - now().getTime();
      return remaining > 0 ? wait(remaining) : fire();
    });

  async function fire() {
    try {
      if (runner.status().running) {
        log('agendamento: ja havia uma execucao rodando, a agendada foi pulada');
      } else {
        log(`agendamento: iniciando a atualizacao do catalogo (${describeSchedule(schedule())})`);
        runner.start('sync', {});
        await runner.idle();
      }
    } catch (err) {
      log(`agendamento: ${err.message}`);
    }
    if (!stopped) arm();
  }

  const onSettingsChange = () =>
    safely(() => {
      if (JSON.stringify(schedule()) !== armedFor) arm();
    });

  const unsubscribe = store.onChange(onSettingsChange);
  arm();

  function stop() {
    stopped = true;
    clear();
    unsubscribe();
  }

  return { status, stop };
}

module.exports = { createScheduler };
