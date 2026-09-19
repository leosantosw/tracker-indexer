import { $, el, elapsed } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { JOBS } from '../lib/labels.js';

const PILL_STYLE = {
  idle: ['bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300', 'bg-zinc-400'],
  running: ['bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300', 'bg-indigo-500 animate-pulse'],
  cancelling: ['bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300', 'bg-amber-500 animate-pulse'],
  offline: ['bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300', 'bg-rose-500'],
};

let ticker = null;

/** Text collapses to icon-only on small screens. */
const label = (text) => el('span', { class: 'hidden sm:inline' }, text);

function pillState(job, connected) {
  if (!connected) return 'offline';
  if (!job.running) return 'idle';
  return job.running.cancelling ? 'cancelling' : 'running';
}

function pillText(job, state) {
  if (state === 'offline') return 'reconectando…';
  if (state === 'idle') return 'ocioso';
  const what = state === 'cancelling' ? `cancelando ${JOBS[job.running.job].title.toLowerCase()}` : JOBS[job.running.job].running;
  return `${what} · ${elapsed(job.running.startedAt)}`;
}

function renderPill(job, connected) {
  const state = pillState(job, connected);
  const [pillClass, dotClass] = PILL_STYLE[state];
  const pill = $('#job-pill');
  const text = el('span', { class: 'tabular-nums' }, pillText(job, state));

  pill.className = `inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${pillClass}`;
  pill.replaceChildren(el('span', { class: `size-2 rounded-full ${dotClass}` }), text);

  clearInterval(ticker);
  if (job.running) ticker = setInterval(() => (text.textContent = pillText(job, state)), 1000);
}

function iconButton(name, label, { active = false, ...attrs } = {}) {
  const current = active ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100' : '';
  return el(
    attrs.href ? 'a' : 'button',
    { class: `btn btn-ghost btn-icon ${current}`, title: label, 'aria-label': label, 'aria-current': active ? 'page' : false, ...attrs },
    icon(name, 'size-5')
  );
}

export function renderHeader({ job, connected, hasEnabled, hasTmdbKey, page }, actions) {
  renderPill(job, connected);
  $('#progress').hidden = !job.running;

  const running = Boolean(job.running);
  const buttons = [
    iconButton('book', 'Documentação da API', { href: '/api/docs', target: '_blank', rel: 'noopener' }),
    iconButton('sliders', 'Configurações', { href: '#/configuracoes', active: page === 'settings' }),
    el('span', { class: 'mx-1 h-6 w-px bg-zinc-200 dark:bg-zinc-800' }),
    running
      ? el(
          'button',
          { class: 'btn btn-danger', disabled: job.running.cancelling, onclick: actions.cancel },
          icon('stop'),
          label(job.running.cancelling ? 'Cancelando…' : 'Cancelar')
        )
      : [
          el(
            'button',
            {
              class: 'btn btn-secondary relative',
              title: hasTmdbKey ? JOBS.enrich.hint : 'Falta a TMDB_API_KEY: cadastre em Configurações → Segredos',
              onclick: actions.enrich,
            },
            icon('sparkles'),
            label(JOBS.enrich.action),
            !hasTmdbKey && el('span', { class: 'absolute -top-1 -right-1 size-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-zinc-950' })
          ),
          el(
            'button',
            {
              class: 'btn btn-primary',
              disabled: !hasEnabled,
              title: hasEnabled ? JOBS.sync.hint : 'Nenhum tracker ativo',
              onclick: () => actions.sync(),
            },
            icon('refresh'),
            label(JOBS.sync.action)
          ),
        ],
  ];

  $('#header-actions').replaceChildren(...buttons.flat());
}
