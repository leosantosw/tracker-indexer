import { el, formatNumber, numberOrNull } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { SOURCE_SYNC } from '../lib/labels.js';
import { badge, field, numberInput, toggleRow } from '../components/controls.js';
import { pageBar } from '../components/pageBar.js';
import { tagInput } from '../components/tagInput.js';
import { group, twoColumns } from './settings/layout.js';
import { MODE_LABEL, avatar } from './trackers.js';

const SUBTITLE = {
  terms: 'Varre por termos de busca · resultado ordenado por seeders',
  pages: 'Varre a listagem do catálogo · mais novo primeiro',
};

function header(source, { indexed, running, sync, check }) {
  return el(
    'header',
    { class: 'mb-8' },
    el('a', { href: '#/', class: 'text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100' }, '← Painel'),
    el(
      'div',
      { class: 'mt-3 flex flex-wrap items-center gap-4' },
      avatar(source, 'size-12'),
      el(
        'div',
        { class: 'min-w-0 flex-1' },
        el(
          'div',
          { class: 'flex flex-wrap items-center gap-2' },
          el('h2', { class: 'truncate text-2xl font-semibold tracking-tight' }, source.name),
          badge(MODE_LABEL[source.mode]),
          source.enabled ? badge('ativo', 'emerald') : badge('inativo')
        ),
        el('p', { class: 'mt-1 text-sm text-zinc-500' }, `${SUBTITLE[source.mode]} · ${formatNumber(indexed)} torrents indexados`)
      ),
      el(
        'button',
        { type: 'button', class: 'btn btn-secondary', title: 'Lê a primeira página e mostra o que entraria, sem gravar', onclick: check },
        icon('flask'),
        'Testar'
      ),
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn-secondary',
          disabled: !source.enabled || running,
          title: source.enabled ? SOURCE_SYNC.hint(source.name) : 'Ative o tracker para buscar torrents',
          onclick: sync,
        },
        icon('play'),
        SOURCE_SYNC.action
      )
    )
  );
}

function dangerZone({ indexed, running, onClear }) {
  return group(
    { id: 'perigo', title: 'Zona de perigo', description: 'Ações que não dá para desfazer.' },
    el(
      'div',
      { class: 'flex flex-wrap items-center justify-between gap-4 rounded-xl p-4 ring-1 ring-rose-200 dark:ring-rose-500/30' },
      el(
        'div',
        {},
        el('p', { class: 'label' }, 'Apagar resultados'),
        el('p', { class: 'hint mt-0.5' }, `Remove os ${formatNumber(indexed)} torrents deste tracker. Capas e notas da TMDB ficam.`)
      ),
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn-danger',
          disabled: !indexed || running,
          title: running ? 'Espere o job atual terminar' : '',
          onclick: onClear,
        },
        icon('trash'),
        'Apagar'
      )
    )
  );
}

/**
 * Full page for one tracker. Like the settings page it holds its own draft and
 * is drawn on open, not on every live update, so typing is never wiped.
 */
export function renderTrackerPage(container, source, { indexed, running, save, sync, check, clear }) {
  const byTerms = source.mode === 'terms';
  const draft = {
    enabled: source.enabled,
    rps: source.rps,
    pages: source.pages,
    stopAfterQuietPages: source.stopAfterQuietPages,
    rules: { ...source.rules },
    ...(byTerms && { terms: [...source.terms] }),
  };

  const form = el(
    'form',
    {
      class: 'pb-28',
      onsubmit: (event) => {
        event.preventDefault();
        save(source.name, draft);
      },
    },
    header(source, { indexed, running, sync: () => sync([source.name]), check: () => check(source.name) }),
    el(
      'div',
      { class: 'space-y-6' },
      group(
        { id: 'geral', title: 'Geral', description: 'Se o tracker entra na atualização do catálogo e em que ritmo.' },
        toggleRow({
          label: 'Tracker ativo',
          hint: 'Inativo, ele fica fora de toda atualização do catálogo — pela CLI também.',
          checked: draft.enabled,
          onChange: (value) => (draft.enabled = value),
        }),
        field({
          label: 'Requisições por segundo',
          hint: 'Cortesia com o site: abaixo de 1 espaça ainda mais as chamadas.',
          input: numberInput({ value: draft.rps, min: 0.1, step: 0.1, required: true, onInput: (v) => (draft.rps = Number(v)) }),
        })
      ),
      group(
        { id: 'varredura', title: 'Varredura', description: 'Até onde cada execução vai.' },
        twoColumns(
          field({
            label: byTerms ? 'Páginas por termo' : 'Páginas por varredura',
            hint: 'Vazio: vai até a última página.',
            input: numberInput({ value: draft.pages, placeholder: 'todas', onInput: (v) => (draft.pages = numberOrNull(v)) }),
          }),
          field({
            label: 'Parar após N sem novidade',
            hint: byTerms ? 'Aqui parar cedo perde torrent novo.' : 'Vazio varre até o fim.',
            input: numberInput({
              value: draft.stopAfterQuietPages,
              placeholder: 'nunca',
              onInput: (v) => (draft.stopAfterQuietPages = numberOrNull(v)),
            }),
          })
        )
      ),
      group(
        { id: 'regras', title: 'Regras', description: 'Valem só para o catálogo deste tracker.' },
        toggleRow({
          label: 'Exigir ano',
          hint: 'Item sem ano fica de fora: sem ele não dá para casar com a TMDB.',
          checked: draft.rules.requireYear,
          onChange: (value) => (draft.rules.requireYear = value),
        }),
        toggleRow({
          label: 'Deduplicar por seeders',
          hint: 'Da mesma obra fica só a cópia mais semeada. Não serve para tracker sem seeders.',
          checked: draft.rules.dedupe === 'seeders',
          onChange: (value) => (draft.rules.dedupe = value ? 'seeders' : null),
        })
      ),
      byTerms &&
        group(
          {
            id: 'termos',
            title: 'Termos de busca',
            description: 'Mínimo de 3 caracteres. A busca é AND: termo composto só traz subconjunto do simples.',
          },
          tagInput({
            values: draft.terms,
            minLength: 3,
            placeholder: 'novo termo + Enter',
            onChange: (terms) => (draft.terms = terms),
          })
        ),
      dangerZone({ indexed, running, onClear: () => clear(source.name) })
    ),
    pageBar()
  );

  container.replaceChildren(form);
}
