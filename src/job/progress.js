'use strict';

const MAX_WARNINGS = 20;

/**
 * Structured progress of one run, for the panel to draw instead of parsing the
 * log. Every change hands a snapshot to `report`; nothing is stored anywhere.
 *
 *   phase     'sources' | 'tmdb' | 'cache' | 'done'
 *   sources   [{ name, state, pages, maxPages, terms, termIndex, inserted, removed }]
 *   tmdb      { state, total, done, ok, notFound, ambiguous, skipped, failed, startedAt, reason } | null
 *   cache     { state, total, done, cached, reason } | null
 *   warnings  [{ source, text }]
 */
const pendingTmdb = () => ({ state: 'pending', total: 0, done: 0, ok: 0, notFound: 0, ambiguous: 0, skipped: 0, failed: 0, startedAt: null, reason: null });

const pendingCache = () => ({ state: 'pending', total: 0, done: 0, cached: 0, reason: null });

function firstPhase({ sources, tmdb }) {
  if (sources.length) return 'sources';
  return tmdb ? 'tmdb' : 'cache';
}

function createProgress(report = () => {}, { sources = [], tmdb = true, cache = false } = {}) {
  const state = {
    phase: firstPhase({ sources, tmdb }),
    sources: sources.map((source) => ({
      name: source.name,
      state: 'pending',
      pages: 0,
      maxPages: Number.isFinite(source.pages) ? source.pages : null,
      terms: source.terms?.length ?? null,
      byCategory: Boolean(source.categories),
      termIndex: null,
      inserted: 0,
      removed: 0,
    })),
    tmdb: tmdb ? pendingTmdb() : null,
    cache: cache ? pendingCache() : null,
    warnings: [],
  };

  const emit = () => report(structuredClone(state));
  const sourceOf = (name) => state.sources.find((source) => source.name === name);

  return {
    snapshot: () => structuredClone(state),

    startSource(name) {
      state.phase = 'sources';
      sourceOf(name).state = 'running';
      emit();
    },

    page(name, { termIndex, inserted }) {
      const source = sourceOf(name);
      Object.assign(source, { termIndex, pages: source.pages + 1, inserted: source.inserted + inserted });
      emit();
    },

    endSource(name, { removed = 0 } = {}) {
      Object.assign(sourceOf(name), { state: 'done', removed });
      emit();
    },

    startTmdb(total) {
      state.phase = 'tmdb';
      Object.assign(state.tmdb, { state: 'running', total, startedAt: new Date().toISOString() });
      emit();
    },

    /** `status` is the saved result ('ok', 'not_found', ...) or 'failed'. */
    tmdbStep(status) {
      const key = { ok: 'ok', not_found: 'notFound', ambiguous: 'ambiguous', skipped: 'skipped', failed: 'failed' }[status];
      state.tmdb.done++;
      state.tmdb[key]++;
      emit();
    },

    /** 'done' | 'skipped' | 'failed', with the same `reason` codes the runner uses. */
    endTmdb(result, reason = null) {
      Object.assign(state.tmdb, { state: result, reason });
      emit();
    },

    startCache(total) {
      state.phase = 'cache';
      Object.assign(state.cache, { state: 'running', total });
      emit();
    },

    cacheBatch({ checked, cached }) {
      state.cache.done += checked;
      state.cache.cached += cached;
      emit();
    },

    endCache(result, reason = null) {
      state.phase = 'cache';
      Object.assign(state.cache, { state: result, reason });
      emit();
    },

    warn(source, text) {
      if (state.warnings.length < MAX_WARNINGS) state.warnings.push({ source, text });
      emit();
    },

    finish() {
      state.phase = 'done';
      emit();
    },
  };
}

module.exports = { createProgress };
