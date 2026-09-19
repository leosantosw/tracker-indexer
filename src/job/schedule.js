'use strict';

const MINUTE = 60 * 1000;
const DAY_NAMES = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/**
 * When the next run happens, or null when the schedule is off. `interval`
 * counts from `from` (the end of the last run); `daily` is the next listed
 * weekday at `time`, in the server's local time.
 */
function nextRun(schedule, from = new Date()) {
  if (!schedule?.enabled) return null;

  if (schedule.mode === 'interval') return new Date(from.getTime() + schedule.everyMinutes * MINUTE);

  const [hours, minutes] = schedule.time.split(':').map(Number);
  const days = schedule.days?.length ? schedule.days : ALL_DAYS;

  for (let offset = 0; offset <= 7; offset++) {
    const candidate = new Date(from);
    candidate.setDate(from.getDate() + offset);
    candidate.setHours(hours, minutes, 0, 0);
    if (candidate > from && days.includes(candidate.getDay())) return candidate;
  }
  return null;
}

function describeInterval(minutes) {
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? 'a cada 1 hora' : `a cada ${hours} horas`;
  }
  return minutes === 1 ? 'a cada 1 minuto' : `a cada ${minutes} minutos`;
}

/** "todo dia as 23:00", "seg, qua as 08:30", "a cada 2 horas". */
function describeSchedule(schedule) {
  if (!schedule?.enabled) return 'desligado';
  if (schedule.mode === 'interval') return describeInterval(schedule.everyMinutes);

  const days = [...(schedule.days?.length ? schedule.days : ALL_DAYS)].sort();
  const when = days.length === 7 ? 'todo dia' : days.map((day) => DAY_NAMES[day]).join(', ');
  return `${when} as ${schedule.time}`;
}

module.exports = { nextRun, describeSchedule, ALL_DAYS };
