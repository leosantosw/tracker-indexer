import { $, el, formatNumber } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { badge, toggle, setToggle } from '../components/controls.js';
import { SOURCE_SYNC } from '../lib/labels.js';

const MODE_LABEL = { terms: 'busca', pages: 'catálogo' };

function spec(iconName, text) {
  return el(
    'li',
    { class: 'inline-flex items-center gap-1.5 rounded-lg bg-zinc-50 px-2.5 py-1 text-xs text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300' },
    icon(iconName, 'size-3.5 text-zinc-400'),
    text
  );
}

function pagesLabel(source) {
  if (!source.pages) return source.mode === 'terms' ? 'todas as páginas por termo' : 'todas as páginas';
  return source.mode === 'terms' ? `${source.pages} págs/termo` : `${source.pages} páginas`;
}

function specs(source) {
  return [
    spec('gauge', `${source.rps} req/s`),
    source.mode === 'terms' && spec('search', `${source.terms.length} termos`),
    spec('layers', pagesLabel(source)),
    source.stopAfterQuietPages && spec('clock', `para após ${source.stopAfterQuietPages} sem novidade`),
  ];
}

function rules(source) {
  const active = [
    source.rules.requireYear && badge('exige ano', 'indigo'),
    source.rules.dedupe === 'seeders' && badge('dedupe por seeders', 'indigo'),
  ].filter(Boolean);
  return active.length ? active : [badge('sem regras')];
}

function card(source, { indexed, running, actions }) {
  const enabled = source.enabled;

  const switcher = toggle({
    checked: enabled,
    label: `${enabled ? 'Desativar' : 'Ativar'} ${source.name}`,
    onChange: async (next, button) => {
      button.disabled = true;
      const ok = await actions.saveSource(source.name, { enabled: next }, `${source.name} ${next ? 'ativado' : 'desativado'}`);
      if (!ok) setToggle(button, !next);
      button.disabled = false;
    },
  });

  return el(
    'article',
    { class: `card flex flex-col p-5 transition ${enabled ? '' : 'opacity-60'}` },
    el(
      'div',
      { class: 'flex items-start gap-4' },
      el(
        'div',
        { class: `grid size-10 shrink-0 place-items-center rounded-xl text-sm font-bold uppercase ${enabled ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300' : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800'}` },
        source.name.slice(0, 2)
      ),
      el(
        'div',
        { class: 'min-w-0 flex-1' },
        el('div', { class: 'flex items-center gap-2' }, el('h3', { class: 'truncate font-semibold' }, source.name), badge(MODE_LABEL[source.mode])),
        el('p', { class: 'mt-0.5 text-sm text-zinc-500' }, `${formatNumber(indexed)} torrents indexados`)
      ),
      el('div', { class: 'flex items-center gap-2 text-xs text-zinc-500' }, enabled ? 'ativo' : 'inativo', switcher)
    ),
    el('ul', { class: 'mt-4 flex flex-wrap gap-1.5' }, specs(source)),
    el('div', { class: 'mt-3 flex flex-wrap gap-1.5' }, rules(source)),
    el(
      'div',
      { class: 'mt-5 flex items-center justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800' },
      el(
        'button',
        {
          class: 'btn btn-ghost',
          disabled: !enabled || running,
          title: enabled ? SOURCE_SYNC.hint(source.name) : 'Ative o tracker para buscar torrents',
          onclick: () => actions.sync([source.name]),
        },
        icon('play'),
        SOURCE_SYNC.action
      ),
      el('button', { class: 'btn btn-secondary', onclick: () => actions.editTracker(source.name) }, icon('pencil'), 'Editar')
    )
  );
}

export function renderTrackers({ settings, stats, job }, actions) {
  const indexed = Object.fromEntries(stats.sources.map((row) => [row.source, row.total]));
  const context = { running: Boolean(job.running), actions };

  $('#trackers').replaceChildren(
    ...settings.sources.map((source) => card(source, { ...context, indexed: indexed[source.name] ?? 0 }))
  );
}
