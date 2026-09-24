import { $, el, ago, elapsed, formatNumber, plural } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { badge } from '../components/controls.js';
import { JOBS, REASONS, RESULTS } from '../lib/labels.js';
import { mountLog, lineCount, scrollLogToEnd } from './log.js';

const LOG_OPEN_KEY = 'activity:log-open';

const storage = {
  get: () => {
    try {
      return localStorage.getItem(LOG_OPEN_KEY) === '1';
    } catch {
      return false;
    }
  },
  set: (open) => {
    try {
      localStorage.setItem(LOG_OPEN_KEY, open ? '1' : '0');
    } catch {
      // private window: the choice just isn't remembered
    }
  },
};

let body;
let logBox;
let toggleButton;
let ticker = null;

// --- small pieces ---

const spinner = () => el('span', { class: 'size-4 shrink-0 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600 dark:border-indigo-500/30 dark:border-t-indigo-400' });

const STATE_ICON = {
  pending: () => el('span', { class: 'size-4 shrink-0 rounded-full border-2 border-zinc-300 dark:border-zinc-700' }),
  running: spinner,
  done: () => el('span', { class: 'grid size-4 shrink-0 place-items-center rounded-full bg-emerald-500 text-white' }, icon('check', 'size-3')),
  skipped: () => el('span', { class: 'grid size-4 shrink-0 place-items-center rounded-full bg-amber-400 text-white' }, icon('minus', 'size-3')),
  failed: () => el('span', { class: 'grid size-4 shrink-0 place-items-center rounded-full bg-rose-500 text-white' }, icon('x', 'size-3')),
};

const stateIcon = (state) => (STATE_ICON[state] ?? STATE_ICON.pending)();

function step(number, title, state, ...content) {
  return el(
    'li',
    { class: 'relative pl-9' },
    el(
      'span',
      {
        class: `absolute top-0 left-0 grid size-6 place-items-center rounded-full text-xs font-semibold ${
          state === 'pending' ? 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800' : 'bg-indigo-600 text-white'
        }`,
      },
      String(number)
    ),
    el('p', { class: 'text-sm leading-6 font-semibold' }, title),
    el('div', { class: 'mt-2 space-y-2' }, ...content)
  );
}

function bar(done, total) {
  const share = total ? Math.min(100, (done / total) * 100) : 0;
  return el(
    'div',
    { class: 'h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800' },
    el('div', { class: 'h-full rounded-full bg-indigo-500 transition-all duration-300', style: `width:${share}%` })
  );
}

function eta(tmdb) {
  if (!tmdb.startedAt || tmdb.done < 5) return null;
  const spent = Date.now() - new Date(tmdb.startedAt);
  const left = ((tmdb.total - tmdb.done) * spent) / tmdb.done / 1000;
  if (left < 60) return `~${Math.max(5, Math.round(left / 5) * 5)} s`;
  return `~${Math.round(left / 60)} min`;
}

const countText = (inserted) => (inserted ? `+${formatNumber(inserted)} novos` : 'nada novo');

// --- trackers step ---

function sourceDetail(source) {
  if (source.state === 'pending') return 'na fila';
  if (source.state === 'done') {
    const removed = source.removed ? ` · ${plural(source.removed, 'removido', 'removidos')} pelas regras` : '';
    return `${plural(source.pages, 'página', 'páginas')} · ${countText(source.inserted)}${removed}`;
  }

  const where = source.terms
    ? `termo ${(source.termIndex ?? 0) + 1} de ${source.terms}`
    : `página ${source.pages + 1}${source.maxPages ? ` de ${source.maxPages}` : ''}`;
  return `${where} · ${countText(source.inserted)}`;
}

function sourceRow(source) {
  return el(
    'div',
    { class: 'flex items-center gap-3 text-sm' },
    stateIcon(source.state),
    el('span', { class: `font-medium ${source.state === 'pending' ? 'text-zinc-400' : ''}` }, source.name),
    el('span', { class: 'truncate text-zinc-500 tabular-nums' }, sourceDetail(source))
  );
}

// --- TMDB step ---

function tmdbContent(tmdb) {
  if (tmdb.state === 'pending') return [el('p', { class: 'text-sm text-zinc-400' }, 'aguardando os trackers')];
  if (tmdb.state === 'skipped') return [el('p', { class: 'text-sm text-amber-700 dark:text-amber-300' }, REASONS[tmdb.reason]?.text ?? 'pulada')];
  if (tmdb.state === 'failed') return [el('p', { class: 'text-sm text-rose-600 dark:text-rose-400' }, 'a TMDB falhou; capas e notas ficam para a próxima')];
  if (tmdb.state === 'done' && !tmdb.total) return [el('p', { class: 'text-sm text-zinc-500' }, 'nenhuma obra nova para consultar')];

  const remaining = tmdb.state === 'running' ? eta(tmdb) : null;
  return [
    bar(tmdb.done, tmdb.total),
    el(
      'p',
      { class: 'text-sm text-zinc-500 tabular-nums' },
      `${formatNumber(tmdb.done)} de ${plural(tmdb.total, 'obra', 'obras')}`,
      remaining && ` · ${remaining}`,
      ` · ${formatNumber(tmdb.ok)} casadas`,
      tmdb.notFound + tmdb.ambiguous ? ` · ${formatNumber(tmdb.notFound + tmdb.ambiguous)} sem match` : '',
      tmdb.failed ? ` · ${formatNumber(tmdb.failed)} com erro` : ''
    ),
  ];
}

function warnings(list) {
  if (!list?.length) return null;
  return el(
    'ul',
    { class: 'space-y-1.5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200' },
    list.map(({ source, text }) =>
      el('li', { class: 'flex gap-2' }, icon('alert', 'mt-0.5 size-4 shrink-0'), el('span', {}, source && el('b', { class: 'font-semibold' }, `${source}: `), text))
    )
  );
}

// --- the two faces of the card ---

function runningView(running) {
  const { progress } = running;
  const title = running.cancelling ? `Cancelando ${JOBS[running.job].title.toLowerCase()}…` : `${JOBS[running.job].title} em andamento`;

  const head = el(
    'div',
    { class: 'flex items-center gap-3' },
    spinner(),
    el('h2', { class: 'font-semibold' }, title),
    el('span', { class: 'ml-auto font-mono text-sm text-zinc-500 tabular-nums', 'data-elapsed': running.startedAt }, elapsed(running.startedAt))
  );

  if (!progress) return [head, el('p', { class: 'mt-4 text-sm text-zinc-500' }, 'Iniciando…')];

  const steps = [];
  if (progress.sources.length) {
    const state = progress.sources.every((source) => source.state === 'done') ? 'done' : 'running';
    steps.push(step(steps.length + 1, 'Trackers', state, progress.sources.map(sourceRow)));
  }
  steps.push(step(steps.length + 1, 'Capas e notas', progress.tmdb.state, tmdbContent(progress.tmdb)));

  return [head, el('ol', { class: 'mt-5 space-y-6' }, steps), warnings(progress.warnings) && el('div', { class: 'mt-5' }, warnings(progress.warnings))];
}

function duration(last) {
  const seconds = Math.round((new Date(last.finishedAt) - new Date(last.startedAt)) / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, '0')}s`;
}

function summaryFacts(progress) {
  if (!progress) return [];
  const inserted = progress.sources.reduce((sum, source) => sum + source.inserted, 0);
  const { tmdb } = progress;
  return [
    progress.sources.length && `${countText(inserted).replace('novos', 'torrents novos')}`,
    tmdb.state === 'done' && tmdb.total && `${plural(tmdb.ok, 'obra casada', 'obras casadas')} na TMDB`,
    tmdb.state === 'done' && tmdb.notFound + tmdb.ambiguous && `${formatNumber(tmdb.notFound + tmdb.ambiguous)} sem match`,
    tmdb.state === 'done' && tmdb.total === 0 && 'nenhuma obra nova para a TMDB',
  ].filter(Boolean);
}

function idleView(last) {
  if (!last) {
    return [
      el('h2', { class: 'font-semibold' }, 'Atividade'),
      el('p', { class: 'mt-1 text-sm text-zinc-500' }, 'Nenhuma execução desde que o servidor subiu. Clique em Atualizar catálogo para começar.'),
    ];
  }

  const [label, tone] = RESULTS[last.result];
  const facts = summaryFacts(last.progress);

  return [
    el(
      'div',
      { class: 'flex flex-wrap items-center gap-x-3 gap-y-1' },
      stateIcon({ done: 'done', skipped: 'skipped', cancelled: 'skipped', failed: 'failed' }[last.result]),
      el('h2', { class: 'font-semibold' }, JOBS[last.job].title),
      badge(label, tone),
      el('span', { class: 'text-sm text-zinc-500' }, `${ago(last.finishedAt)} · levou ${duration(last)}`)
    ),
    facts.length && el('p', { class: 'mt-2 pl-7 text-sm text-zinc-600 dark:text-zinc-300' }, facts.join(' · ')),
    last.error && el('p', { class: 'mt-2 pl-7 text-sm text-rose-600 dark:text-rose-400' }, last.error),
    warnings(last.progress?.warnings) && el('div', { class: 'mt-4' }, warnings(last.progress.warnings)),
  ].filter(Boolean);
}

// --- mount and render ---

function updateToggle(count = lineCount()) {
  const open = !logBox.hidden;
  toggleButton.replaceChildren(
    icon('terminal', 'size-4'),
    `${open ? 'Ocultar' : 'Ver'} logs técnicos`,
    count ? el('span', { class: 'text-zinc-400 tabular-nums' }, `(${plural(count, 'linha', 'linhas')})`) : ''
  );
}

function setLogOpen(open) {
  logBox.hidden = !open;
  storage.set(open);
  updateToggle();
  if (open) scrollLogToEnd();
}

export function mountActivity() {
  body = el('div', { class: 'p-5 sm:p-6' });
  logBox = el('div', { hidden: !storage.get() });
  toggleButton = el('button', { type: 'button', class: 'btn btn-ghost py-1.5 text-sm', onclick: () => setLogOpen(logBox.hidden) });

  $('#activity').replaceChildren(
    el(
      'div',
      { class: 'card overflow-hidden' },
      body,
      el('div', { class: 'flex justify-end border-t border-zinc-100 px-3 py-2 dark:border-zinc-800' }, toggleButton),
      logBox
    )
  );
  mountLog(logBox, { onChange: updateToggle });
  updateToggle();
}

export function renderActivity({ job }) {
  // replaceChildren would print a null child as the text "null".
  body.replaceChildren(...(job.running ? runningView(job.running) : idleView(job.last)).filter(Boolean));

  clearInterval(ticker);
  if (job.running) {
    ticker = setInterval(() => {
      for (const node of body.querySelectorAll('[data-elapsed]')) node.textContent = elapsed(node.dataset.elapsed);
    }, 1000);
  }
}
