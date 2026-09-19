'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const { nextRun, describeSchedule } = require('../src/job/schedule');
const { createScheduler } = require('../src/job/scheduler');

// Quarta-feira, 16/09/2026, 10:00 no horario local.
const WEDNESDAY_10H = new Date(2026, 8, 16, 10, 0, 0);

const daily = (time, days = [0, 1, 2, 3, 4, 5, 6]) => ({ enabled: true, mode: 'daily', time, days, everyMinutes: 60 });
const every = (everyMinutes) => ({ enabled: true, mode: 'interval', time: '03:00', days: [], everyMinutes });

test('desligado nao tem proxima execucao', () => {
  assert.equal(nextRun({ ...daily('23:00'), enabled: false }, WEDNESDAY_10H), null);
});

test('diario: ainda hoje, se o horario nao passou', () => {
  assert.deepEqual(nextRun(daily('23:00'), WEDNESDAY_10H), new Date(2026, 8, 16, 23, 0));
});

test('diario: amanha, se o horario ja passou', () => {
  assert.deepEqual(nextRun(daily('08:30'), WEDNESDAY_10H), new Date(2026, 8, 17, 8, 30));
});

test('diario: pula para o proximo dia da semana marcado', () => {
  // Quarta 10h, so segunda: a proxima e a segunda seguinte.
  assert.deepEqual(nextRun(daily('09:00', [1]), WEDNESDAY_10H), new Date(2026, 8, 21, 9, 0));
});

test('intervalo: conta a partir de agora', () => {
  assert.deepEqual(nextRun(every(90), WEDNESDAY_10H), new Date(2026, 8, 16, 11, 30));
});

test('descricao legivel', () => {
  assert.equal(describeSchedule(daily('23:00')), 'todo dia as 23:00');
  assert.equal(describeSchedule(daily('08:30', [3, 1])), 'seg, qua as 08:30');
  assert.equal(describeSchedule(every(1)), 'a cada 1 minuto');
  assert.equal(describeSchedule(every(120)), 'a cada 2 horas');
  assert.equal(describeSchedule({ enabled: false }), 'desligado');
});

// --- agendador ---

function setup(schedule, { running = false } = {}) {
  let listener;
  let current = schedule;
  const timers = {
    pending: [],
    setTimeout(fn, ms) {
      const timer = { fn, ms };
      this.pending.push(timer);
      return timer;
    },
    clearTimeout(timer) {
      this.pending = this.pending.filter((t) => t !== timer);
    },
  };
  const runner = {
    running,
    started: 0,
    status() {
      return { running: this.running ? { job: 'sync' } : null };
    },
    start(job) {
      assert.equal(job, 'sync', 'o agendamento roda a atualizacao do catalogo (sync + enrich)');
      this.started++;
    },
    idle: async () => {},
  };
  const store = {
    config: () => ({ schedule: current }),
    onChange(fn) {
      listener = fn;
      return () => (listener = null);
    },
  };
  const logs = [];
  const scheduler = createScheduler({ store, runner, timers, log: (m) => logs.push(m), now: () => WEDNESDAY_10H });

  return {
    scheduler,
    timers,
    runner,
    logs,
    change(next) {
      current = next;
      listener?.();
    },
  };
}

test('agendador: desligado nao arma nada', () => {
  const { scheduler, timers } = setup({ ...daily('23:00'), enabled: false });
  assert.equal(timers.pending.length, 0);
  assert.deepEqual(scheduler.status(), { enabled: false, description: 'desligado', nextRunAt: null });
});

test('agendador: arma para a hora certa e roda a atualizacao', async () => {
  const { scheduler, timers, runner } = setup(daily('23:00'));

  assert.equal(timers.pending.length, 1);
  assert.equal(timers.pending[0].ms, 13 * 60 * 60 * 1000);
  assert.equal(scheduler.status().nextRunAt, new Date(2026, 8, 16, 23, 0).toISOString());

  await timers.pending.shift().fn(); // a real timer leaves the list when it fires
  assert.equal(runner.started, 1);
  assert.equal(timers.pending.length, 1, 'rearma depois de rodar');
});

test('agendador: com outra execucao rodando, pula e rearma', async () => {
  const { timers, runner, logs } = setup(every(1), { running: true });

  await timers.pending.shift().fn(); // a real timer leaves the list when it fires

  assert.equal(runner.started, 0);
  assert.match(logs.join('\n'), /pulada/);
  assert.equal(timers.pending.length, 1);
});

test('agendador: mudar a configuracao rearma na hora', () => {
  const { scheduler, timers, change } = setup(daily('23:00'));

  change(every(5));
  assert.equal(timers.pending.length, 1, 'o timer antigo foi cancelado');
  assert.equal(timers.pending[0].ms, 5 * 60 * 1000);

  change({ ...every(5), enabled: false });
  assert.equal(timers.pending.length, 0);
  assert.equal(scheduler.status().enabled, false);
});

test('agendador: parar cancela o timer', () => {
  const { scheduler, timers } = setup(daily('23:00'));
  scheduler.stop();
  assert.equal(timers.pending.length, 0);
});
