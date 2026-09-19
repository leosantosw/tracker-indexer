import { el } from '../lib/dom.js';
import { icon } from '../lib/icons.js';

/** Free-text tags: Enter, comma or paste adds; Backspace on empty removes the last one. */
export function tagInput({ values, placeholder, minLength = 1, onChange }) {
  let items = [...values];

  const input = el('input', { class: 'min-w-36 flex-1 bg-transparent py-1 text-sm outline-none', placeholder });
  const box = el('div', {
    class: 'input flex min-h-24 flex-wrap content-start items-center gap-1.5 cursor-text',
    onclick: () => input.focus(),
  });

  const chip = (value) =>
    el(
      'span',
      {
        class:
          'inline-flex items-center gap-1 rounded-md bg-white py-0.5 pr-1 pl-2 text-xs font-medium ' +
          'ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700',
      },
      value,
      el(
        'button',
        {
          type: 'button',
          'aria-label': `remover ${value}`,
          class: 'rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-700',
          onclick: () => update(items.filter((item) => item !== value)),
        },
        icon('x', 'size-3')
      )
    );

  function update(next) {
    items = next;
    box.replaceChildren(...items.map(chip), input);
    onChange([...items]);
  }

  function commit(text) {
    const fresh = text
      .split(/[\n,]/)
      .map((term) => term.trim())
      .filter((term) => term.length >= minLength && !items.includes(term));
    if (fresh.length) update([...items, ...new Set(fresh)]);
  }

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commit(input.value);
      input.value = '';
    } else if (event.key === 'Backspace' && !input.value && items.length) {
      update(items.slice(0, -1));
    }
  });
  input.addEventListener('paste', (event) => {
    event.preventDefault();
    commit(event.clipboardData.getData('text'));
  });
  input.addEventListener('blur', () => {
    commit(input.value);
    input.value = '';
  });

  box.replaceChildren(...items.map(chip), input);
  return box;
}
