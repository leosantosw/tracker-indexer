'use strict';

const { sourceDefaults } = require('../sources');
const { providerOptions } = require('../debrid');
const { SettingsError } = require('./errors');

const EDITABLE_TMDB = ['language', 'rps', 'staleDays', 'minVotes'];
const EDITABLE_SOURCE = ['enabled', 'rps', 'pages', 'stopAfterQuietPages', 'content'];
const EDITABLE_DEBRID = ['provider'];
const EDITABLE_SCHEDULE = ['enabled', 'mode', 'time', 'days', 'everyMinutes'];

const pick = (obj = {}, keys) =>
  Object.fromEntries(keys.filter((key) => key in obj).map((key) => [key, obj[key]]));

function mergeSource(defaults, saved = {}) {
  return {
    ...defaults,
    ...pick(saved, EDITABLE_SOURCE),
    terms: defaults.mode === 'terms' && saved.terms ? saved.terms : defaults.terms,
    rules: { ...defaults.rules, ...saved.rules },
  };
}

/** Config shaped like `config.js`, with the non-secret overrides on top. */
function buildConfig(base, saved) {
  return {
    ...base,
    tmdb: { ...base.tmdb, ...pick(saved.tmdb, EDITABLE_TMDB) },
    debrid: { ...base.debrid, ...pick(saved.debrid, EDITABLE_DEBRID) },
    schedule: { ...base.schedule, ...pick(saved.schedule, EDITABLE_SCHEDULE) },
    sources: sourceDefaults().map((source) => mergeSource(source, saved.sources?.[source.name])),
  };
}

const editableView = (config) => ({
  tmdb: pick(config.tmdb, EDITABLE_TMDB),
  sources: config.sources,
  debrid: { provider: config.debrid.provider, providers: providerOptions() },
  schedule: config.schedule,
});

function mergeSourcePatches(saved = {}, patches) {
  const known = new Set(sourceDefaults().map((source) => source.name));
  const unknown = Object.keys(patches).filter((name) => !known.has(name));
  if (unknown.length) throw new SettingsError(`tracker desconhecido: ${unknown.join(', ')}`);

  const merged = { ...saved };
  for (const [name, patch] of Object.entries(patches)) {
    const current = saved[name] ?? {};
    merged[name] = { ...current, ...patch, rules: { ...current.rules, ...patch.rules } };
  }
  return merged;
}

/** Partial update of the plain sections: only what `patch` carries changes. */
function mergePatch(saved, patch) {
  const sections = {};
  if (patch.tmdb) sections.tmdb = { ...saved.tmdb, ...patch.tmdb };
  if (patch.debrid) sections.debrid = { ...saved.debrid, ...patch.debrid };
  if (patch.schedule) sections.schedule = { ...saved.schedule, ...patch.schedule };
  if (patch.sources) sections.sources = mergeSourcePatches(saved.sources, patch.sources);
  return sections;
}

module.exports = { buildConfig, editableView, mergePatch };
