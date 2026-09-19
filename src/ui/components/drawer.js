import { $, el } from '../lib/dom.js';
import { icon } from '../lib/icons.js';

const drawer = () => $('#drawer');

export const closeDrawer = () => drawer().close();

/** Clicking the backdrop closes it; Esc is native to <dialog>. */
export function bindDrawer() {
  drawer().addEventListener('click', (event) => {
    if (event.target === drawer()) closeDrawer();
  });
}

/**
 * Side panel with a form. `onSubmit` returns truthy to close; `extra` sits on
 * the left of the footer, for secondary actions like "restaurar".
 */
export function openDrawer({ title, subtitle, body, onSubmit, submitLabel = 'Salvar', extra }) {
  const submit = el('button', { class: 'btn btn-primary' }, submitLabel);

  const form = el(
    'form',
    {
      class: 'flex h-full flex-col',
      onsubmit: async (event) => {
        event.preventDefault();
        submit.disabled = true;
        const done = await onSubmit();
        submit.disabled = false;
        if (done) closeDrawer();
      },
    },
    el(
      'header',
      { class: 'flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5 dark:border-zinc-800' },
      el(
        'div',
        { class: 'min-w-0' },
        el('h2', { class: 'truncate text-base font-semibold' }, title),
        subtitle && el('p', { class: 'mt-0.5 text-sm text-zinc-500' }, subtitle)
      ),
      el(
        'button',
        { type: 'button', class: 'btn btn-ghost btn-icon -mr-2', 'aria-label': 'fechar', onclick: closeDrawer },
        icon('x', 'size-5')
      )
    ),
    el('div', { class: 'flex-1 space-y-8 overflow-y-auto px-6 py-6' }, body),
    el(
      'footer',
      { class: 'flex items-center gap-2 border-t border-zinc-200 bg-zinc-50/60 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950/40' },
      extra,
      el('div', { class: 'ml-auto flex gap-2' }, el('button', { type: 'button', class: 'btn btn-secondary', onclick: closeDrawer }, 'Cancelar'), submit)
    )
  );

  drawer().replaceChildren(form);
  if (!drawer().open) drawer().showModal();
}
