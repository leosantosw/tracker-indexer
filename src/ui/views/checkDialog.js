import { el, formatNumber, plural } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { badge } from '../components/controls.js';

const STATUS = {
  ok: ['entra', 'emerald'],
  filtered: ['fora do filtro', 'zinc'],
  rejected: ['rejeitado', 'amber'],
  'no-year': ['sem ano', 'amber'],
  'no-magnet': ['sem magnet', 'rose'],
};

const statusBadge = (status) => badge(...(STATUS[status] ?? [status, 'zinc']));

function verdict({ entries, totals }) {
  const ok = totals.ok ?? 0;
  const good = ok > 0;
  return el(
    'div',
    {
      class: `flex gap-3 rounded-xl px-4 py-3 text-sm ${
        good ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200' : 'bg-rose-50 text-rose-900 dark:bg-rose-500/10 dark:text-rose-200'
      }`,
    },
    icon(good ? 'check' : 'alert', 'mt-0.5 size-4 shrink-0'),
    el(
      'p',
      {},
      good
        ? `Funcionando: ${formatNumber(ok)} de ${plural(entries.length, 'título', 'títulos')} da primeira página entrariam no catálogo.`
        : entries.length
          ? 'Nenhum título entraria no catálogo. O site pode ter mudado o layout.'
          : 'A primeira página veio vazia. O site pode estar fora do ar ou ter mudado o layout.'
    )
  );
}

function results(result) {
  const chips = Object.entries(result.totals).map(([status, total]) =>
    el('span', { class: 'inline-flex items-center gap-1.5' }, statusBadge(status), el('span', { class: 'text-sm tabular-nums text-zinc-500' }, formatNumber(total)))
  );

  return [
    verdict(result),
    chips.length && el('div', { class: 'flex flex-wrap gap-x-4 gap-y-2' }, chips),
    result.entries.length &&
      el(
        'ul',
        { class: 'max-h-80 divide-y divide-zinc-100 overflow-y-auto rounded-xl ring-1 ring-zinc-200 dark:divide-zinc-800 dark:ring-zinc-800' },
        result.entries.map(({ status, detail }) =>
          el(
            'li',
            { class: 'flex items-center gap-3 px-3 py-2 text-sm' },
            el('span', { class: 'w-28 shrink-0' }, statusBadge(status)),
            el('span', { class: 'truncate', title: detail ?? '' }, detail ?? '—')
          )
        )
      ),
  ].filter(Boolean);
}

const loading = (name) =>
  el(
    'div',
    { class: 'flex items-center gap-3 py-6 text-sm text-zinc-500' },
    el('span', { class: 'size-5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600' }),
    `Lendo a primeira página de ${name}… tracker HTML pode levar uns 20 segundos.`
  );

const failure = (message) =>
  el(
    'div',
    { class: 'flex gap-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:bg-rose-500/10 dark:text-rose-200' },
    icon('alert', 'mt-0.5 size-4 shrink-0'),
    el('p', {}, message)
  );

/**
 * Tests a tracker like `npm run check-source`: reads its first page and shows
 * what would enter the catalog. `run` does the request; nothing is saved.
 */
export async function openCheckDialog(name, run) {
  const content = el('div', { class: 'space-y-4' }, loading(name));

  const dialog = el(
    'dialog',
    {
      class:
        'm-auto w-[min(40rem,94vw)] rounded-2xl bg-white p-0 text-inherit shadow-2xl ' +
        'backdrop:bg-zinc-950/50 backdrop:backdrop-blur-sm dark:bg-zinc-900',
    },
    el(
      'form',
      { method: 'dialog', class: 'space-y-5 p-6' },
      el(
        'div',
        { class: 'flex items-start gap-4' },
        el(
          'div',
          { class: 'grid size-10 shrink-0 place-items-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300' },
          icon('flask', 'size-5')
        ),
        el(
          'div',
          { class: 'min-w-0' },
          el('h2', { class: 'text-base font-semibold' }, `Teste de ${name}`),
          el('p', { class: 'mt-1 text-sm text-zinc-500 dark:text-zinc-400' }, 'Lê a primeira página e mostra o que entraria no catálogo. Nada é gravado.')
        )
      ),
      content,
      el('div', { class: 'flex justify-end' }, el('button', { class: 'btn btn-secondary' }, 'Fechar'))
    )
  );

  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();

  try {
    content.replaceChildren(...results(await run(name)));
  } catch (err) {
    content.replaceChildren(failure(err.message));
  }
}
