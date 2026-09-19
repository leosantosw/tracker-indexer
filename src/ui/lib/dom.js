export const $ = (selector) => document.querySelector(selector);

/** Tiny element builder: el('p', { class: 'hint' }, 'texto', child). */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key in node && typeof value !== 'string') node[key] = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children.flat().filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}

export const time = (iso) => new Date(iso).toLocaleTimeString('pt-BR');

const relative = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

export function ago(iso) {
  const seconds = Math.round((new Date(iso) - Date.now()) / 1000);
  if (Math.abs(seconds) < 60) return relative.format(seconds, 'second');
  if (Math.abs(seconds) < 3600) return relative.format(Math.round(seconds / 60), 'minute');
  if (Math.abs(seconds) < 86400) return relative.format(Math.round(seconds / 3600), 'hour');
  return relative.format(Math.round(seconds / 86400), 'day');
}

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** "hoje às 23:00", "amanhã às 08:30", "seg, 21/09 às 09:00". */
export function when(iso) {
  const date = new Date(iso);
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(date) - startOf(new Date())) / 86400000);

  if (days === 0) return `hoje às ${time}`;
  if (days === 1) return `amanhã às ${time}`;
  const day = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `${WEEKDAYS[date.getDay()]}, ${day} às ${time}`;
}

export function elapsed(iso) {
  const total = Math.max(0, Math.floor((Date.now() - new Date(iso)) / 1000));
  const minutes = String(Math.floor(total / 60)).padStart(2, '0');
  return `${minutes}:${String(total % 60).padStart(2, '0')}`;
}

export const formatNumber = (value) => value.toLocaleString('pt-BR');

/** plural(1, 'linha', 'linhas') -> '1 linha'. */
export const plural = (count, one, many) => `${formatNumber(count)} ${count === 1 ? one : many}`;

export const numberOrNull = (value) => (value === '' ? null : Number(value));

const TOAST_STYLE = {
  ok: 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900',
  warn: 'bg-amber-500 text-amber-950',
  error: 'bg-rose-600 text-white',
};

export function toast(message, kind = 'ok') {
  const item = el(
    'div',
    { class: `pointer-events-auto max-w-sm rounded-xl px-4 py-2.5 text-sm shadow-lg ${TOAST_STYLE[kind]}`, role: 'status' },
    message
  );
  $('#toast').append(item);
  setTimeout(() => item.remove(), 3500);
}

/** Runs an action, reporting success or failure in a toast. Null means it failed. */
export async function attempt(action, success) {
  try {
    const result = await action();
    if (success) toast(success);
    return result ?? true;
  } catch (err) {
    toast(err.message, 'error');
    return null;
  }
}
