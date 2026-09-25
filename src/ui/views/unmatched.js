import { api } from '../lib/api.js';
import { $, el, ago, formatNumber, plural, toast } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { badge } from '../components/controls.js';
import { openMatchDialog } from './matchDialog.js';

const PAGE_SIZE = 10;

const STATUS = {
  not_found: ['sem match', 'zinc'],
  ambiguous: ['ambígua', 'amber'],
};

const STATUS_FILTERS = [
  [null, 'Todas'],
  ['not_found', 'Sem match'],
  ['ambiguous', 'Ambíguas'],
];

const TYPE_LABEL = { movie: 'Filme', series: 'Série' };

const view = { filter: { source: null, status: null }, works: [], total: 0, page: 0, counts: null, loading: false, onMatched: () => {} };

const countOf = (rows, key, value) => rows.find((row) => row[key] === value)?.total ?? 0;

function statusTabs() {
  const all = view.counts.byStatus.reduce((sum, row) => sum + row.total, 0);
  return el(
    'div',
    { class: 'inline-flex rounded-lg bg-zinc-100 p-0.5 text-sm dark:bg-zinc-800', role: 'tablist' },
    STATUS_FILTERS.map(([status, label]) => {
      const active = view.filter.status === status;
      const total = status ? countOf(view.counts.byStatus, 'status', status) : all;
      return el(
        'button',
        {
          type: 'button',
          role: 'tab',
          'aria-selected': String(active),
          class: `rounded-md px-3 py-1 font-medium transition ${
            active ? 'bg-white shadow-sm dark:bg-zinc-900' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`,
          onclick: () => filterUnmatched({ status }),
        },
        `${label} `,
        el('span', { class: 'tabular-nums text-zinc-400' }, formatNumber(total))
      );
    })
  );
}

function sourceSelect() {
  return el(
    'select',
    { class: 'input w-auto py-1.5', 'aria-label': 'Tracker', onchange: (event) => filterUnmatched({ source: event.target.value || null }) },
    el('option', { value: '', selected: !view.filter.source }, 'Todos os trackers'),
    view.counts.bySource.map(({ source, total }) =>
      el('option', { value: source, selected: view.filter.source === source }, `${source} (${formatNumber(total)})`)
    )
  );
}

function afterMatch() {
  view.onMatched();
  return fetchPage(1);
}

function rawNames(work) {
  const [first] = work.names;
  if (!first) return null;
  const all = work.names.map(({ source, rawName }) => `${source}: ${rawName}`).join('\n');
  return el(
    'p',
    { class: 'truncate text-xs text-zinc-500', title: all },
    el('span', { class: 'font-medium' }, `${first.source}: `),
    el('code', {}, first.rawName),
    work.names.length > 1 && el('span', { class: 'ml-1 font-medium' }, `+${work.names.length - 1}`)
  );
}

function row(work) {
  const [statusLabel, tone] = STATUS[work.status];
  const checked = ago(new Date(work.checkedAt * 1000).toISOString());
  const meta = [TYPE_LABEL[work.type] ?? work.type, plural(work.torrents, 'torrent', 'torrents'), `verificada ${checked}`].join(' · ');

  return el(
    'li',
    { class: 'flex items-center gap-3 px-5 py-2.5' },
    el(
      'div',
      { class: 'min-w-0 flex-1' },
      el(
        'div',
        { class: 'flex min-w-0 items-center gap-2' },
        el('span', { class: 'truncate font-medium' }, work.title),
        work.year && el('span', { class: 'shrink-0 text-sm text-zinc-500 tabular-nums' }, `(${work.year})`),
        badge(statusLabel, tone),
        el('span', { class: 'hidden shrink-0 text-xs text-zinc-400 sm:inline' }, meta)
      ),
      rawNames(work)
    ),
    el(
      'button',
      {
        type: 'button',
        class: 'btn btn-secondary shrink-0 px-2.5 py-1.5 text-xs',
        onclick: () => openMatchDialog(work, { onMatched: afterMatch }),
      },
      icon('sparkles', 'size-3.5'),
      'Match manual'
    )
  );
}

function empty() {
  const filtered = view.filter.source || view.filter.status;
  return el(
    'li',
    { class: 'px-5 py-8 text-center text-sm text-zinc-500' },
    filtered ? 'Nada com esse filtro.' : 'Tudo casado: nenhuma obra sem match na TMDB.'
  );
}

function more() {
  if (view.works.length >= view.total) return null;
  return el(
    'div',
    { class: 'border-t border-zinc-100 px-5 py-3 text-center dark:border-zinc-800' },
    el(
      'button',
      { type: 'button', class: 'btn btn-ghost text-sm', disabled: view.loading, onclick: () => fetchPage(view.page + 1) },
      view.loading ? 'Carregando…' : `Mostrar mais (${formatNumber(view.total - view.works.length)})`
    )
  );
}

function render() {
  const section = $('#unmatched');
  if (!view.counts) return;

  section.replaceChildren(
    el(
      'div',
      { class: 'flex flex-wrap items-end justify-between gap-3' },
      el(
        'div',
        {},
        el('h2', { class: 'text-lg font-semibold' }, 'Sem match na TMDB'),
        el('p', { class: 'text-sm text-zinc-500' }, 'Obras com torrent que a TMDB não reconheceu, com o nome que veio de cada tracker.')
      ),
      el('div', { class: 'flex flex-wrap items-center gap-2' }, statusTabs(), sourceSelect())
    ),
    el(
      'div',
      { class: 'card mt-4 overflow-hidden' },
      el('ul', { class: 'divide-y divide-zinc-100 dark:divide-zinc-800' }, view.works.length ? view.works.map(row) : empty()),
      more()
    )
  );
}

async function fetchPage(page) {
  view.loading = true;
  render();
  try {
    const params = { page, limit: PAGE_SIZE, ...(view.filter.source && { source: view.filter.source }), ...(view.filter.status && { status: view.filter.status }) };
    const result = await api.unmatched(params);
    view.works = page === 1 ? result.works : [...view.works, ...result.works];
    Object.assign(view, { total: result.total, page, counts: result.counts });
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    view.loading = false;
    render();
  }
}

export function filterUnmatched(patch) {
  Object.assign(view.filter, patch);
  return fetchPage(1);
}

export function mountUnmatched({ onMatched }) {
  view.onMatched = onMatched;
}

export const loadUnmatched = () => fetchPage(1);
