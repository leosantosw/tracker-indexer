'use strict';

const { createHttpClient } = require('../lib/http');
const { createTmdb } = require('./tmdb');

/**
 * Para adicionar um tracker: crie o arquivo dele e acrescente uma linha aqui.
 * Contrato: { name, rps, rules?, create({ getJson, getText }) -> { fetchPage, toItem } }
 * A varredura e por `terms` (busca) ou por `pages` (listagem paginada).
 */
const SOURCES = [
  require('./trackers/torrentsCsv'),
  require('./trackers/redesTorrents'),
  require('./trackers/comando'),
  require('./trackers/torrentDosFilmes'),
  require('./trackers/amigosShareClub'),
];

const MODULES = new Map(SOURCES.map((source) => [source.name, source]));

const loginSources = () => SOURCES.filter((source) => source.requiresLogin).map((source) => source.name);

/** What each tracker declares in code: the baseline the admin UI overrides. */
const sourceDefaults = () =>
  SOURCES.map(({ name, site, access, requiresLogin, rps, terms, pages, stopAfterQuietPages, content, categories, freeleechOnly, rules }) => ({
    name,
    site,
    access,
    requiresLogin: Boolean(requiresLogin),
    mode: terms ? 'terms' : 'pages',
    enabled: !requiresLogin,
    rps,
    terms: terms ? [...terms] : null,
    pages: pages ?? null,
    stopAfterQuietPages: stopAfterQuietPages ?? null,
    content: content ?? 'movies',
    categories: categories ?? null,
    ...(freeleechOnly !== undefined && { freeleechOnly }),
    rules: { requireYear: false, dedupe: null, ...rules },
  }));

/** Only enabled trackers are built, unless asked; `signal` aborts their in-flight requests. */
function createSources(config, { signal, includeDisabled = false } = {}) {
  return (config.sources ?? sourceDefaults())
    .filter((settings) => includeDisabled || settings.enabled)
    .map(({ enabled, mode, ...settings }) => {
      const http = createHttpClient({ rps: settings.rps, ...config.http, signal });
      return { ...settings, ...MODULES.get(settings.name).create(http, settings) };
    });
}

/**
 * A TMDB nao e um tracker: nao indexa nada, so enriquece o que ja foi
 * indexado. Fica aqui por dividir o cliente HTTP com throttle e retry.
 * Sem chave configurada devolve null, e o enriquecimento e pulado.
 */
function createTmdbClient(config, { signal } = {}) {
  if (!config.tmdb.apiKey) return null;

  const { getJson } = createHttpClient({ rps: config.tmdb.rps, ...config.http, signal });
  return createTmdb({
    getJson,
    apiKey: config.tmdb.apiKey,
    language: config.tmdb.language,
  });
}

module.exports = { createSources, createTmdbClient, sourceDefaults, loginSources };
