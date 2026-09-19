import { el } from '../../lib/dom.js';
import { field, toggleRow } from '../../components/controls.js';
import { group } from './layout.js';
import { SECTIONS } from './groups.js';

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const UNITS = { minutes: 1, hours: 60 };

const choice = (active) =>
  'rounded-md px-3 py-1.5 text-sm font-medium transition ' +
  (active
    ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700'
    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100');

/** Two-option switcher; `onPick` gets the chosen value. */
function segmented(options, current, onPick) {
  const buttons = options.map(({ value, label }) =>
    el('button', { type: 'button', 'data-value': value, class: choice(value === current) }, label)
  );
  for (const button of buttons) {
    button.addEventListener('click', () => {
      for (const other of buttons) other.className = choice(other === button);
      onPick(button.dataset.value);
    });
  }
  return el('div', { class: 'inline-flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-950' }, buttons);
}

function dayPicker(draft) {
  const buttons = DAYS.map((label, day) => {
    const button = el('button', { type: 'button', 'aria-pressed': String(draft.schedule.days.includes(day)) }, label);
    button.className =
      'size-11 rounded-lg text-sm font-medium ring-1 ring-zinc-200 transition dark:ring-zinc-700 ' +
      'aria-pressed:bg-indigo-600 aria-pressed:text-white aria-pressed:ring-indigo-600';
    button.addEventListener('click', () => {
      const days = new Set(draft.schedule.days);
      if (days.has(day) && days.size === 1) return; // at least one day stays marked
      days.has(day) ? days.delete(day) : days.add(day);
      draft.schedule.days = [...days].sort();
      button.setAttribute('aria-pressed', String(days.has(day)));
    });
    return button;
  });
  return el('div', { class: 'flex flex-wrap gap-2' }, buttons);
}

function intervalInput(draft) {
  const minutes = draft.schedule.everyMinutes;
  let unit = minutes % 60 === 0 ? 'hours' : 'minutes';
  const amount = el('input', {
    type: 'number',
    class: 'input w-28 tabular-nums',
    min: 1,
    required: true,
    value: minutes / UNITS[unit],
  });
  const select = el(
    'select',
    { class: 'input w-36' },
    el('option', { value: 'minutes', selected: unit === 'minutes' }, 'minutos'),
    el('option', { value: 'hours', selected: unit === 'hours' }, 'horas')
  );

  const sync = () => (draft.schedule.everyMinutes = Math.max(1, Math.round(Number(amount.value) * UNITS[unit])));
  amount.addEventListener('input', sync);
  select.addEventListener('change', () => {
    unit = select.value;
    sync();
  });

  return el('div', { class: 'flex items-center gap-2' }, el('span', { class: 'text-sm text-zinc-500' }, 'A cada'), amount, select);
}

/**
 * Automatic catalog update: sync, then enrich, on a fixed time or an interval.
 * `next` is the scheduler's own answer, shown as is.
 */
export function scheduleGroup({ schedule, next }, draft) {
  draft.schedule = { ...schedule, days: [...schedule.days] };

  const daily = el(
    'div',
    { class: 'space-y-5' },
    field({
      label: 'Horário',
      hint: 'No relógio do servidor.',
      input: el('input', {
        type: 'time',
        class: 'input w-40 tabular-nums',
        value: schedule.time,
        required: true,
        oninput: (event) => (draft.schedule.time = event.target.value),
      }),
    }),
    el('div', { class: 'space-y-1.5' }, el('span', { class: 'label block' }, 'Dias'), dayPicker(draft))
  );

  const interval = el(
    'div',
    { class: 'space-y-1.5' },
    intervalInput(draft),
    el('p', { class: 'hint' }, 'Contado a partir do fim da execução anterior, então uma nunca atropela a outra.')
  );

  const details = el('div', { class: 'space-y-6' });
  const refresh = () => {
    details.hidden = !draft.schedule.enabled;
    daily.hidden = draft.schedule.mode !== 'daily';
    interval.hidden = draft.schedule.mode !== 'interval';
  };

  const nextNote = next && el('p', { class: 'text-sm text-zinc-500' }, `Próxima execução: ${next}.`);

  details.append(
    segmented(
      [
        { value: 'daily', label: 'Em horário fixo' },
        { value: 'interval', label: 'A cada intervalo' },
      ],
      schedule.mode,
      (mode) => {
        draft.schedule.mode = mode;
        refresh();
      }
    ),
    daily,
    interval,
    // Native append would print "null": only add the note when there is one.
    ...(nextNote ? [nextNote] : [])
  );
  refresh();

  return group(
    SECTIONS.schedule,
    toggleRow({
      label: 'Atualizar o catálogo automaticamente',
      hint: 'Busca torrents novos e, no fim, capas e notas. Só roda com o servidor no ar.',
      checked: schedule.enabled,
      onChange: (enabled) => {
        draft.schedule.enabled = enabled;
        refresh();
      },
    }),
    details
  );
}
