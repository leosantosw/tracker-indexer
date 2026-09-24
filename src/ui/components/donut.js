import { formatNumber } from '../lib/dom.js';

const SVG = 'http://www.w3.org/2000/svg';
const SIZE = 132;
const STROKE = 18;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 2;

function svg(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  node.append(...children);
  return node;
}

const ring = (className, attrs = {}) =>
  svg('circle', { cx: SIZE / 2, cy: SIZE / 2, r: RADIUS, fill: 'none', 'stroke-width': STROKE, class: className, ...attrs });

export const share = (value, total) => (total ? Math.round((value / total) * 100) : 0);

export function donut(slices, { centerLabel }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const visible = slices.filter((slice) => slice.value > 0);
  const gap = visible.length > 1 ? GAP : 0;

  let offset = 0;
  const segments = visible.map((slice) => {
    const length = (slice.value / total) * CIRCUMFERENCE;
    const segment = ring(`${slice.stroke} transition-opacity hover:opacity-80`, {
      'stroke-dasharray': `${Math.max(length - gap, 0)} ${CIRCUMFERENCE}`,
      'stroke-dashoffset': -offset,
    });
    segment.append(svg('title', {}, `${slice.label}: ${formatNumber(slice.value)} (${share(slice.value, total)}%)`));
    offset += length;
    return segment;
  });

  return svg(
    'svg',
    { viewBox: `0 0 ${SIZE} ${SIZE}`, class: 'size-32 shrink-0', role: 'img', 'aria-label': centerLabel },
    ring('stroke-zinc-100 dark:stroke-zinc-800'),
    svg('g', { transform: `rotate(-90 ${SIZE / 2} ${SIZE / 2})` }, ...segments),
    svg(
      'text',
      { x: '50%', y: '47%', 'text-anchor': 'middle', 'dominant-baseline': 'middle', class: 'fill-zinc-900 text-2xl font-semibold dark:fill-zinc-100' },
      formatNumber(total)
    ),
    svg(
      'text',
      { x: '50%', y: '64%', 'text-anchor': 'middle', 'dominant-baseline': 'middle', class: 'fill-zinc-500 text-[10px] dark:fill-zinc-400' },
      centerLabel
    )
  );
}
