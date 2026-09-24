import { el } from '../lib/dom.js';

/** Fixed footer of a full-page form: `extra` on the left, back and submit on the right. */
export function pageBar({ extra, submitLabel = 'Salvar alterações' } = {}) {
  return el(
    'div',
    {
      class:
        'fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200/80 bg-white/85 backdrop-blur-md ' +
        'dark:border-zinc-800 dark:bg-zinc-950/85',
    },
    el(
      'div',
      { class: 'mx-auto flex max-w-7xl items-center gap-2 px-5 py-3 sm:px-8 lg:px-10' },
      extra,
      el(
        'div',
        { class: 'ml-auto flex gap-2' },
        el('a', { class: 'btn btn-secondary', href: '#/' }, 'Voltar'),
        el('button', { class: 'btn btn-primary' }, submitLabel)
      )
    )
  );
}
