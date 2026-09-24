'use strict';

const { classify } = require('../lib/classifier');

const SKIPPED = { filtered: 'FORA', 'no-magnet': 'SEM MAGNET' };

/** Trackers without `readPage` (a JSON API) only have what `fetchPage` returns. */
async function firstPage(source) {
  if (source.readPage) return source.readPage(1);

  const { items } = await source.fetchPage({ term: source.terms?.[0] ?? null, cursor: null });
  return items.map((raw) => ({ card: { title: raw.name }, item: source.toItem(raw), status: 'ok' }));
}

function verdict(entry, rules = {}) {
  if (entry.status !== 'ok') return { label: SKIPPED[entry.status], detail: entry.card.title };

  const release = classify(entry.item.name);
  if (release.rejected) return { label: 'REJEITADO', detail: entry.item.name };
  if (rules.requireYear && release.year === null) return { label: 'SEM ANO', detail: release.title };

  const marks = [release.year && `(${release.year})`, release.resolution, release.source].filter(Boolean);
  return { label: 'OK', detail: `${release.title} ${marks.join(' ')}` };
}

/**
 * Walks the first page of a tracker through the same steps as the sync and
 * prints where each title stops. Reads only: nothing is saved.
 */
async function checkSource(source, { print = console.log } = {}) {
  const entries = await firstPage(source);
  const totals = {};

  for (const entry of entries) {
    const { label, detail } = verdict(entry, source.rules);
    totals[label] = (totals[label] ?? 0) + 1;
    print(`${label.padEnd(11)}${detail ?? ''}`);
  }

  const summary = Object.entries(totals).map(([label, total]) => `${total} ${label}`);
  print(`\n${source.name}: ${entries.length} na primeira pagina -- ${summary.join(', ') || 'nada encontrado'}`);
  if (!totals.OK) print('nenhum item entraria no catalogo: o template do site mudou?');
}

module.exports = { checkSource };
