import { $, el, plural, time } from '../lib/dom.js';
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
let counter;

export function mountLog() {
  lines = el('div', {
    class:
      'h-80 overflow-y-auto bg-zinc-950 px-5 py-4 font-mono text-[12.5px] leading-relaxed ' +
      "empty:before:text-zinc-600 empty:before:content-['Nenhuma_linha_ainda_—_clique_em_Atualizar_catálogo.']",
    'aria-live': 'polite',
  });
  counter = el('span', { class: 'text-xs text-zinc-500 tabular-nums' });

  $('#log-panel').replaceChildren(
    el(
      'div',
      { class: 'card overflow-hidden' },
      el(
        'div',
        { class: 'flex items-center gap-3 border-b border-zinc-200 px-5 py-3 dark:border-zinc-800' },
        icon('terminal', 'size-4 text-zinc-400'),
        el('h2', { class: 'text-sm font-semibold' }, 'Log ao vivo'),
        counter,
        el(
          'button',
          { class: 'btn btn-ghost ml-auto py-1.5', onclick: clearLog },
          icon('trash', 'size-3.5'),
          'Limpar'
        )
      ),
      lines
    )
  );
  updateCounter();
}

function updateCounter() {
  counter.textContent = lines.childElementCount ? plural(lines.childElementCount, 'linha', 'linhas') : '';
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
  updateCounter();
}

export function clearLog() {
  lines.replaceChildren();
  updateCounter();
}
