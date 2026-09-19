import { el } from '../../lib/dom.js';
import { icon } from '../../lib/icons.js';
import { confirmAction } from '../../components/confirm.js';
import { sideNav } from './layout.js';
import { SECTIONS, tmdbGroup, accessGroup, encryptionNotice } from './groups.js';
import { debridGroup } from './debrid.js';
import { scheduleGroup } from './schedule.js';

function actionBar({ onReset }) {
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
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn-ghost text-rose-600 hover:text-rose-700 dark:text-rose-400',
          title: 'Os segredos são mantidos',
          onclick: onReset,
        },
        icon('undo'),
        el('span', { class: 'hidden sm:inline' }, 'Restaurar padrões')
      ),
      el(
        'div',
        { class: 'ml-auto flex gap-2' },
        el('a', { class: 'btn btn-secondary', href: '#/' }, 'Voltar'),
        el('button', { class: 'btn btn-primary' }, 'Salvar alterações')
      )
    )
  );
}

/**
 * Full-width settings page. Holds its own draft; `save` gets only the
 * sections it edits, plus the secrets that were actually typed.
 */
/** `nextRun` is the scheduler's next run, already formatted, or null. */
export function renderSettingsPage(container, view, { save, removeSecret, reset }, { nextRun = null } = {}) {
  const { tmdb, debrid, secrets, schedule } = view;
  const draft = { tmdb: { ...tmdb }, debrid: { provider: debrid.provider }, secrets: {} };
  const options = { draft, onRemove: removeSecret };

  async function onReset() {
    const ok = await confirmAction({
      title: 'Restaurar padrões?',
      message: 'Descarta o que foi salvo pelo painel em trackers, agendamento, TMDB e debrid. Os segredos são mantidos.',
      confirmLabel: 'Restaurar',
    });
    if (ok) reset();
  }

  const form = el(
    'form',
    {
      class: 'pb-28',
      onsubmit: (event) => {
        event.preventDefault();
        save({
          tmdb: draft.tmdb,
          debrid: draft.debrid,
          schedule: draft.schedule,
          ...(Object.keys(draft.secrets).length && { secrets: draft.secrets }),
        });
      },
    },
    el(
      'header',
      { class: 'mb-8' },
      el('a', { href: '#/', class: 'text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100' }, '← Painel'),
      el('h2', { class: 'mt-2 text-2xl font-semibold tracking-tight' }, 'Configurações'),
      encryptionNotice(secrets)
    ),
    el(
      'div',
      { class: 'grid gap-10 lg:grid-cols-[12rem_1fr]' },
      sideNav(Object.values(SECTIONS)),
      el(
        'div',
        { class: 'space-y-6' },
        scheduleGroup({ schedule, next: nextRun }, draft),
        tmdbGroup({ tmdb, secrets }, options),
        debridGroup({ debrid, secrets }, options),
        accessGroup(secrets, options)
      )
    ),
    actionBar({ onReset })
  );

  container.replaceChildren(form);
}

/** Brings a group into view, for links like "Cadastrar chave". */
export const focusSettingsGroup = (id) =>
  document.getElementById(`cfg-${id}`)?.scrollIntoView({ block: 'start' });
