import { el } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { randomToken } from '../lib/random.js';
import { badge } from './controls.js';
import { copyButton } from './copyButton.js';

const SOURCE_BADGE = {
  panel: ['salva no painel', 'emerald'],
  env: ['vinda do .env', 'indigo'],
};

const MASK = '****************';

/**
 * Write-only field for one secret. `meta` = { label, hint, missing: [text, tone],
 * generate? }. A secret already set starts locked behind a mask: it only takes
 * a new value after "Editar", and "Cancelar" locks it again, dropping the draft.
 */
export function secretField({ name, meta, status, encryption, draft, onRemove }) {
  const [text, tone] = SOURCE_BADGE[status.source] ?? meta.missing;
  const isSet = Boolean(status.source);

  const input = el('input', {
    type: 'password',
    class: 'input font-mono disabled:cursor-not-allowed disabled:opacity-70',
    autocomplete: 'off',
    spellcheck: 'false',
    oninput: (event) => {
      const value = event.target.value.trim();
      if (value) draft.secrets[name] = value;
      else delete draft.secrets[name];
    },
  });

  const generate =
    meta.generate &&
    el(
      'button',
      {
        type: 'button',
        class: 'btn btn-secondary shrink-0',
        onclick: () => {
          input.type = 'text';
          input.value = randomToken();
          input.dispatchEvent(new Event('input'));
          input.select();
        },
      },
      'Gerar'
    );

  const copy = meta.generate && copyButton(input);

  const toggle = isSet && el('button', { type: 'button', class: 'btn btn-secondary shrink-0' });

  function setEditing(editing) {
    input.disabled = !encryption || !editing;
    input.value = '';
    input.type = 'password';
    delete draft.secrets[name];

    // The mask is a fixed placeholder, never the real value: the API does not send it back.
    input.placeholder = editing ? 'novo valor' : MASK;
    input.classList.toggle('placeholder:tracking-widest', !editing);
    if (generate) generate.hidden = copy.hidden = !editing || !encryption;

    if (toggle) {
      toggle.replaceChildren(icon(editing ? 'x' : 'pencil', 'size-3.5'), editing ? 'Cancelar' : 'Editar');
      toggle.disabled = !encryption;
    }
    if (editing && isSet) input.focus();
  }

  if (toggle) toggle.addEventListener('click', () => setEditing(input.disabled));
  setEditing(!isSet);

  return el(
    'div',
    { class: 'space-y-2 rounded-xl p-4 ring-1 ring-zinc-200 dark:ring-zinc-800' },
    el(
      'div',
      { class: 'flex items-center justify-between gap-3' },
      el('code', { class: 'text-sm font-semibold' }, meta.label),
      badge(text, tone)
    ),
    el('p', { class: 'hint' }, meta.hint),
    // Two buttons would squeeze the input: they drop to their own row.
    generate
      ? el('div', { class: 'space-y-2' }, input, el('div', { class: 'flex gap-2' }, generate, copy, toggle))
      : el('div', { class: 'flex gap-2' }, input, toggle),
    status.error && el('p', { class: 'text-xs text-rose-600 dark:text-rose-400' }, status.error),
    status.source === 'panel' &&
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn-ghost -ml-2 px-2 py-1 text-xs text-rose-600 dark:text-rose-400',
          onclick: () => onRemove(name),
        },
        icon('trash', 'size-3.5'),
        'Remover do painel'
      )
  );
}
