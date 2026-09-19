import { el } from '../lib/dom.js';

export function toggle({ checked, label, onChange }) {
  const button = el(
    'button',
    {
      type: 'button',
      role: 'switch',
      'aria-checked': String(checked),
      'aria-label': label,
      class:
        'group relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-zinc-300 ' +
        'transition-colors aria-checked:bg-emerald-500 disabled:opacity-50 dark:bg-zinc-700',
      onclick: () => {
        const next = !isOn(button);
        setToggle(button, next);
        onChange(next, button);
      },
    },
    el('span', {
      class:
        'inline-block size-5 translate-x-0.5 rounded-full bg-white shadow-sm ring-1 ring-black/5 ' +
        'transition-transform group-aria-checked:translate-x-5.5',
    })
  );
  return button;
}

const isOn = (button) => button.getAttribute('aria-checked') === 'true';
export const setToggle = (button, value) => button.setAttribute('aria-checked', String(value));

export function field({ label, hint, input }) {
  return el(
    'label',
    { class: 'block space-y-1.5' },
    el('span', { class: 'label block' }, label),
    input,
    hint && el('p', { class: 'hint' }, hint)
  );
}

export function numberInput({ value, placeholder, min = 1, step = 1, required = false, onInput }) {
  return el('input', {
    type: 'number',
    class: 'input tabular-nums',
    value: value ?? '',
    placeholder,
    min,
    step,
    required,
    oninput: (event) => onInput(event.target.value),
  });
}

/** A labelled on/off row: text on the left, switch on the right. */
export function toggleRow({ label, hint, checked, onChange }) {
  return el(
    'div',
    { class: 'flex items-start justify-between gap-4' },
    el('div', {}, el('p', { class: 'label' }, label), hint && el('p', { class: 'hint mt-0.5' }, hint)),
    toggle({ checked, label, onChange })
  );
}

export function section(title, ...children) {
  return el('section', { class: 'space-y-4' }, el('h3', { class: 'eyebrow' }, title), ...children);
}

const BADGE_TONE = {
  zinc: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-500/10 dark:text-indigo-300',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
};

export function badge(text, tone = 'zinc') {
  return el('span', { class: `inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${BADGE_TONE[tone]}` }, text);
}
