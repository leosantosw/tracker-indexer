import { $, el, formatNumber } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { badge, toggle, setToggle } from '../components/controls.js';
import { SOURCE_SYNC } from '../lib/labels.js';

export const MODE_LABEL = { terms: 'busca', pages: 'catálogo' };

export const trackerHref = (name) => `#/trackers/${encodeURIComponent(name)}`;

export function avatar(source, size = 'size-9') {
  const tone = source.enabled
    ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300'
    : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800';
  return el('div', { class: `grid ${size} shrink-0 place-items-center rounded-xl text-sm font-bold uppercase ${tone}` }, source.name.slice(0, 2));
}

function summary(source, indexed) {
  return [
    `${formatNumber(indexed)} torrents`,
    `${source.rps} req/s`,
    source.mode === 'terms' && `${source.terms.length} termos`,
  ]
    .filter(Boolean)
    .join(' · ');
}

function rules(source) {
  return [
    source.rules.requireYear && badge('exige ano', 'indigo'),
    source.rules.dedupe === 'seeders' && badge('dedupe', 'indigo'),
  ].filter(Boolean);
}

/** One line per tracker: the whole row opens its page; the switch and play act in place. */
function row(source, { indexed, running, actions }) {
  const { enabled, name } = source;

  const switcher = toggle({
    checked: enabled,
    label: `${enabled ? 'Desativar' : 'Ativar'} ${name}`,
    onChange: async (next, button) => {
      button.disabled = true;
      const ok = await actions.saveSource(name, { enabled: next }, `${name} ${next ? 'ativado' : 'desativado'}`);
      if (!ok) setToggle(button, !next);
      button.disabled = false;
    },
  });

  const play = el(
    'button',
    {
      type: 'button',
      class: 'btn btn-ghost btn-icon',
      disabled: !enabled || running,
      title: enabled ? SOURCE_SYNC.hint(name) : 'Ative o tracker para buscar torrents',
      'aria-label': `${SOURCE_SYNC.action} em ${name}`,
      onclick: () => actions.sync([name]),
    },
    icon('play')
  );

  const check = el(
    'button',
    {
      type: 'button',
      class: 'btn btn-ghost btn-icon',
      title: 'Testar: lê a primeira página e mostra o que entraria, sem gravar',
      'aria-label': `Testar ${name}`,
      onclick: () => actions.checkSource(name),
    },
    icon('flask')
  );

  return el(
    'li',
    {
      class: 'flex cursor-pointer items-center gap-4 px-5 py-3.5 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/40',
      onclick: (event) => {
        if (!event.target.closest('button, a')) location.hash = trackerHref(name);
      },
    },
    avatar(source),
    el(
      'div',
      { class: `min-w-0 flex-1 ${enabled ? '' : 'opacity-60'}` },
      el(
        'div',
        { class: 'flex items-center gap-2' },
        el('a', { href: trackerHref(name), class: 'truncate font-semibold hover:underline' }, name),
        badge(MODE_LABEL[source.mode])
      ),
      el('p', { class: 'mt-0.5 truncate text-sm text-zinc-500' }, summary(source, indexed))
    ),
    el('div', { class: 'hidden gap-1.5 md:flex' }, rules(source)),
    el('div', { class: 'flex items-center gap-1' }, check, play, switcher),
    icon('chevron', 'size-4 shrink-0 text-zinc-400')
  );
}

export function renderTrackers({ settings, stats, job }, actions) {
  const indexed = Object.fromEntries(stats.sources.map((item) => [item.source, item.total]));
  const context = { running: Boolean(job.running), actions };
  const active = settings.sources.filter((source) => source.enabled).length;

  $('#trackers-count').textContent = `${active} de ${settings.sources.length} ativos`;
  $('#trackers').replaceChildren(
    ...settings.sources.map((source) => row(source, { ...context, indexed: indexed[source.name] ?? 0 }))
  );
}
