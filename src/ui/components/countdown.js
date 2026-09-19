import { el } from '../lib/dom.js';

const pad = (n) => String(n).padStart(2, '0');

/** "02:14:33", or "1d 04:10:22" beyond a day; "agora" once it is due. */
export function formatCountdown(ms) {
  if (ms <= 0) return 'agora';
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const clock = `${pad(Math.floor((total % 86400) / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
  return days ? `${days}d ${clock}` : clock;
}

let ticker = null;

/** One interval for the whole page: it rewrites every live countdown on screen. */
function tick() {
  const nodes = document.querySelectorAll('[data-countdown]');
  if (!nodes.length) {
    clearInterval(ticker);
    ticker = null;
    return;
  }
  for (const node of nodes) node.textContent = formatCountdown(new Date(node.dataset.countdown) - Date.now());
}

/** A span counting down to `iso`, updated every second without re-rendering. */
export function countdown(iso, attrs = {}) {
  const node = el('span', { ...attrs, 'data-countdown': iso }, formatCountdown(new Date(iso) - Date.now()));
  ticker ??= setInterval(tick, 1000);
  return node;
}
