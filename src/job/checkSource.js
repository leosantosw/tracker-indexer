'use strict';

const { classify } = require('../lib/classifier');
const { wants } = require('../sources/content');

/** How the CLI prints each outcome; the panel has its own labels. */
const LABELS = { ok: 'OK', filtered: 'FORA', 'no-magnet': 'SEM MAGNET', rejected: 'REJEITADO', 'no-year': 'SEM ANO' };

/** Trackers without `readPage` (a JSON API) only have what `fetchPage` returns. */
async function firstPage(source) {
  if (source.readPage) return source.readPage(1);

  const { items } = await source.fetchPage({ term: source.terms?.[0] ?? null, cursor: null });
  return items.map((raw) => ({ card: { title: raw.name }, item: source.toItem(raw), status: 'ok' }));
}

function verdict(entry, { rules = {}, content }) {
  if (entry.status !== 'ok') return { status: entry.status, detail: entry.card.title };

  const release = classify(entry.item.name);
  if (release.rejected) return { status: 'rejected', detail: entry.item.name };
  if (!wants(content, release.type)) return { status: 'filtered', detail: release.canonical };
  if (rules.requireYear && release.type === 'movie' && release.year === null) return { status: 'no-year', detail: release.title };

  return { status: 'ok', detail: release.canonical };
}

/**
 * Walks the first page of a tracker through the same steps as the sync and
 * says where each title stops. Reads only: nothing is saved.
 */
async function inspectSource(source) {
  const entries = (await firstPage(source)).map((entry) => verdict(entry, source));
  const totals = {};
  for (const { status } of entries) totals[status] = (totals[status] ?? 0) + 1;
  return { source: source.name, entries, totals };
}

async function checkSource(source, { print = console.log } = {}) {
  const { entries, totals } = await inspectSource(source);

  for (const { status, detail } of entries) print(`${LABELS[status].padEnd(11)}${detail ?? ''}`);

  const summary = Object.entries(totals).map(([status, total]) => `${total} ${LABELS[status]}`);
  print(`\n${source.name}: ${entries.length} na primeira pagina -- ${summary.join(', ') || 'nada encontrado'}`);
  if (!totals.ok) print('nenhum item entraria no catalogo: o template do site mudou?');
}

module.exports = { checkSource, inspectSource };
