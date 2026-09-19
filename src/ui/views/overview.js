import { $, el, ago, formatNumber, plural, when } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { badge } from '../components/controls.js';
import { JOBS, REASONS, RESULTS } from '../lib/labels.js';
import { countdown } from '../components/countdown.js';

const MATCH = [
  { status: 'ok', label: 'casadas', color: 'bg-emerald-500' },
  { status: 'ambiguous', label: 'ambíguas', color: 'bg-amber-400' },
  { status: 'not_found', label: 'sem match', color: 'bg-zinc-400' },
  { status: 'skipped', label: 'ignoradas', color: 'bg-sky-400' },
];

function tile(iconName, label, ...content) {
  return el(
    'article',
    { class: 'card p-5' },
    el(
      'div',
      { class: 'flex items-center gap-2 text-zinc-500 dark:text-zinc-400' },
      icon(iconName),
      el('span', { class: 'text-sm font-medium' }, label)
    ),
    el('div', { class: 'mt-3' }, ...content)
  );
}

const bigNumber = (value) => el('p', { class: 'text-3xl font-semibold tracking-tight tabular-nums' }, formatNumber(value));
const caption = (text) => el('p', { class: 'mt-1 text-sm text-zinc-500' }, text);

function matchTile(works) {
  const count = Object.fromEntries(works.map((row) => [row.status, row.total]));
  const total = works.reduce((sum, row) => sum + row.total, 0);
  const share = (status) => (total ? ((count[status] ?? 0) / total) * 100 : 0);

  return tile(
    'film',
    'Match com a TMDB',
    el(
      'div',
      { class: 'flex h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800' },
      MATCH.map(({ status, color, label }) =>
        el('div', { class: color, style: `width:${share(status)}%`, title: `${label}: ${count[status] ?? 0}` })
      )
    ),
    el(
      'ul',
      { class: 'mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs whitespace-nowrap' },
      MATCH.map(({ status, color, label }) =>
        el(
          'li',
          { class: 'flex items-center gap-1.5' },
          el('span', { class: `size-2 rounded-full ${color}` }),
          el('span', { class: 'text-zinc-500' }, label),
          el('span', { class: 'ml-auto font-medium tabular-nums' }, formatNumber(count[status] ?? 0))
        )
      )
    )
  );
}

/** Why a run was skipped or only half done, with a shortcut to fix it. */
function reasonNote(code, onFix) {
  const reason = REASONS[code];
  if (!reason) return null;

  return el(
    'div',
    { class: 'mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200' },
    el('p', {}, reason.text),
    reason.fix &&
      el(
        'button',
        { class: 'mt-1 font-semibold underline underline-offset-2 hover:no-underline', onclick: onFix },
        reason.fix
      )
  );
}

/** Same shape as the other tiles: a big live countdown and when it lands. */
function nextRunTile(schedule, actions) {
  if (!schedule?.nextRunAt) {
    return tile(
      'refresh',
      'Próxima atualização',
      el('p', { class: 'text-sm text-zinc-500' }, 'Sem agendamento.'),
      el(
        'button',
        { class: 'mt-1 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400', onclick: actions.openSchedule },
        'Agendar'
      )
    );
  }

  return tile(
    'refresh',
    'Próxima atualização',
    countdown(schedule.nextRunAt, {
      class: 'block font-mono text-2xl font-semibold tracking-tight tabular-nums text-indigo-600 dark:text-indigo-400',
      title: 'Tempo até a próxima atualização automática',
    }),
    caption(when(schedule.nextRunAt))
  );
}

function lastRunTile(last, actions) {
  if (!last) {
    return tile('clock', 'Última execução', el('p', { class: 'text-sm text-zinc-500' }, 'Nenhuma desde que o servidor subiu.'));
  }

  const [label, tone] = RESULTS[last.result];
  return tile(
    'clock',
    'Última execução',
    el('div', { class: 'flex flex-wrap items-center gap-2' }, el('span', { class: 'text-sm font-semibold' }, JOBS[last.job].title), badge(label, tone)),
    caption(ago(last.finishedAt)),
    reasonNote(last.reason, actions.openSettings),
    last.error && el('p', { class: 'mt-2 line-clamp-2 text-xs text-rose-600 dark:text-rose-400' }, last.error)
  );
}

export function renderOverview({ stats, job, schedule }, actions) {
  const torrents = stats.sources.reduce((sum, row) => sum + row.total, 0);
  const matched = stats.works.find((row) => row.status === 'ok')?.total ?? 0;

  $('#overview').replaceChildren(
    tile('database', 'Torrents indexados', bigNumber(torrents), caption(`em ${plural(stats.sources.length, 'tracker', 'trackers')}`)),
    tile('layers', 'Obras no catálogo', bigNumber(matched), caption('casadas com a TMDB')),
    matchTile(stats.works),
    lastRunTile(job.last, actions),
    nextRunTile(schedule, actions)
  );
}
