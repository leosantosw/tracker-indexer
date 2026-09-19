import { el, formatNumber, numberOrNull } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { openDrawer } from '../components/drawer.js';
import { field, numberInput, section, toggleRow } from '../components/controls.js';
import { tagInput } from '../components/tagInput.js';

function dangerZone({ indexed, running, onClear }) {
  return section(
    'Zona de perigo',
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

const SUBTITLE = {
  terms: 'Varre por termos de busca · resultado ordenado por seeders',
  pages: 'Varre a listagem do catálogo · mais novo primeiro',
};

export function openTrackerEditor(source, { indexed, running, save, clear }) {
  const draft = {
    enabled: source.enabled,
    rps: source.rps,
    pages: source.pages,
    stopAfterQuietPages: source.stopAfterQuietPages,
    rules: { ...source.rules },
    ...(source.mode === 'terms' && { terms: [...source.terms] }),
  };
  const byTerms = source.mode === 'terms';

  const body = [
    section(
      'Geral',
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
    section(
      'Varredura',
      el(
        'div',
        { class: 'grid gap-4 sm:grid-cols-2' },
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
    section(
      'Regras',
      toggleRow({
        label: 'Exigir ano',
        hint: 'Apaga item sem ano: sem ele não dá para casar com a TMDB.',
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
      section(
        `Termos de busca`,
        tagInput({
          values: draft.terms,
          minLength: 3,
          placeholder: 'novo termo + Enter',
          onChange: (terms) => (draft.terms = terms),
        }),
        el('p', { class: 'hint' }, 'Mínimo de 3 caracteres. A busca é AND: termo composto só traz subconjunto do simples.')
      ),
    dangerZone({ indexed, running, onClear: () => clear(source.name) }),
  ];

  openDrawer({
    title: source.name,
    subtitle: SUBTITLE[source.mode],
    body,
    onSubmit: () => save(source.name, draft, `${source.name} salvo`),
  });
}
