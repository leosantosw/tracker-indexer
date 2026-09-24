import { el } from '../../lib/dom.js';

/**
 * One block of the settings page: what it is on the left, the fields on the
 * right. Stacks on narrow screens.
 */
export function group({ id, title, description, stacked = false }, ...content) {
  return el(
    'article',
    { id: `cfg-${id}`, class: 'card scroll-mt-24' },
    el(
      'div',
      { class: `grid gap-6 p-6 md:p-8 ${stacked ? '' : 'md:grid-cols-3 md:gap-10'}` },
      el(
        'div',
        {},
        el('h3', { class: 'text-base font-semibold' }, title),
        el('p', { class: 'mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400' }, description)
      ),
      el('div', { class: `space-y-6 ${stacked ? '' : 'md:col-span-2'}` }, ...content)
    )
  );
}

/** Index of the page: scrolls to a group instead of touching the hash route. */
export function sideNav(items) {
  const go = (id) => document.getElementById(`cfg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return el(
    'nav',
    { class: 'sticky top-24 hidden self-start lg:block', 'aria-label': 'Seções das configurações' },
    el(
      'ul',
      { class: 'space-y-1' },
      items.map(({ id, title }) =>
        el(
          'li',
          {},
          el(
            'button',
            {
              type: 'button',
              class:
                'w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-600 hover:bg-white hover:text-zinc-900 ' +
                'dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100',
              onclick: () => go(id),
            },
            title
          )
        )
      )
    )
  );
}

export const twoColumns = (...fields) => el('div', { class: 'grid gap-5 sm:grid-cols-2' }, ...fields);
