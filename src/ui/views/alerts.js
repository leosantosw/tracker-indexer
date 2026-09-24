import { $, el } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { REASONS } from '../lib/labels.js';

/** Why the last run was skipped or only half done, above the cards, with a shortcut to fix it. */
export function renderAlerts({ job }, actions) {
  const reason = REASONS[job.last?.reason];

  $('#alerts').replaceChildren(
    ...(reason
      ? [
          el(
            'div',
            {
              role: 'alert',
              class:
                'flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200 ' +
                'dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/20',
            },
            icon('alert', 'size-4 shrink-0'),
            el('p', { class: 'flex-1' }, reason.text),
            reason.fix &&
              el(
                'button',
                { type: 'button', class: 'font-semibold underline underline-offset-2 hover:no-underline', onclick: actions.openSettings },
                reason.fix
              )
          ),
        ]
      : [])
  );
  $('#alerts').hidden = !reason;
}
