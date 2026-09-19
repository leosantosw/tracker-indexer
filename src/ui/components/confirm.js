import { el } from '../lib/dom.js';
import { icon } from '../lib/icons.js';

/**
 * "Tem certeza?" as a modal. With `requireText`, the button only unlocks once
 * the user types it -- for actions that cannot be undone. Resolves to a boolean.
 */
export function confirmAction({ title, message, confirmLabel = 'Confirmar', requireText }) {
  return new Promise((resolve) => {
    const confirm = el('button', { class: 'btn btn-danger', value: 'confirm', disabled: Boolean(requireText) }, confirmLabel);

    const typed =
      requireText &&
      el(
        'label',
        { class: 'block space-y-1.5' },
        el('span', { class: 'text-sm text-zinc-600 dark:text-zinc-300' }, 'Digite ', el('code', { class: 'font-semibold' }, requireText), ' para confirmar'),
        el('input', {
          class: 'input font-mono',
          autocomplete: 'off',
          spellcheck: 'false',
          oninput: (event) => (confirm.disabled = event.target.value.trim() !== requireText),
        })
      );

    const dialog = el(
      'dialog',
      {
        class:
          'm-auto w-[min(28rem,92vw)] rounded-2xl bg-white p-0 text-inherit shadow-2xl ' +
          'backdrop:bg-zinc-950/50 backdrop:backdrop-blur-sm dark:bg-zinc-900',
      },
      el(
        'form',
        { method: 'dialog', class: 'space-y-5 p-6' },
        el(
          'div',
          { class: 'flex gap-4' },
          el(
            'div',
            { class: 'grid size-10 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400' },
            icon('alert', 'size-5')
          ),
          el('div', {}, el('h2', { class: 'text-base font-semibold' }, title), el('p', { class: 'mt-1 text-sm text-zinc-500 dark:text-zinc-400' }, message))
        ),
        typed,
        el(
          'div',
          { class: 'flex justify-end gap-2' },
          el('button', { class: 'btn btn-secondary', value: 'cancel', formnovalidate: true }, 'Cancelar'),
          confirm
        )
      )
    );

    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'confirm');
      dialog.remove();
    });

    document.body.append(dialog);
    dialog.showModal();
    (typed ? dialog.querySelector('input') : confirm).focus();
  });
}
