import { el, time } from '../lib/dom.js';
import { icon } from '../lib/icons.js';

const MAX_LINES = 1000;

const TONES = [
  [/falhou|erro|recusad|HTTP \d{3}|template mudou/i, 'text-rose-400'],
  [/cancel|pulado/i, 'text-amber-300'],
  [/concluido/i, 'text-emerald-400'],
  [/iniciado/i, 'text-indigo-300'],
];

const toneOf = (message) => TONES.find(([pattern]) => pattern.test(message))?.[1] ?? 'text-zinc-300';

let lines;
let notify = () => {};

export const lineCount = () => lines?.childElementCount ?? 0;

/** The raw terminal lines, for whoever wants them. `onChange` hears the line count. */
export function mountLog(container, { onChange = () => {} } = {}) {
  notify = onChange;
  lines = el('div', {
    class:
      'h-80 overflow-y-auto px-5 py-4 font-mono text-[12.5px] leading-relaxed ' +
      "empty:before:text-zinc-600 empty:before:content-['Nenhuma_linha_ainda.']",
    'aria-live': 'polite',
  });

  container.replaceChildren(
    el(
      'div',
      { class: 'bg-zinc-950' },
      el(
        'div',
        { class: 'flex items-center gap-2 border-b border-zinc-800 px-5 py-2 text-xs text-zinc-500' },
        icon('terminal', 'size-3.5'),
        'Saída do servidor, como no terminal',
        el(
          'button',
          { type: 'button', class: 'ml-auto inline-flex items-center gap-1.5 rounded px-2 py-1 hover:bg-zinc-800 hover:text-zinc-300', onclick: clearLog },
          icon('trash', 'size-3.5'),
          'Limpar'
        )
      ),
      lines
    )
  );
}

export function appendLog({ at, message }) {
  const stick = lines.scrollHeight - lines.scrollTop - lines.clientHeight < 40;

  lines.append(
    el(
      'div',
      { class: 'flex gap-4 whitespace-pre-wrap break-words' },
      el('time', { class: 'shrink-0 text-zinc-600 select-none' }, time(at)),
      el('span', { class: toneOf(message) }, message)
    )
  );
  while (lines.childElementCount > MAX_LINES) lines.firstElementChild.remove();
  if (stick) lines.scrollTop = lines.scrollHeight;
  notify(lineCount());
}

export function clearLog() {
  lines.replaceChildren();
  notify(0);
}

/** Opening the panel scrolls to the newest line. */
export const scrollLogToEnd = () => lines && (lines.scrollTop = lines.scrollHeight);
