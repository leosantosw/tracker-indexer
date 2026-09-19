'use strict';

const { createHttpClient } = require('../http');
const { createTmdb } = require('./tmdb');

/**
 * Para adicionar um tracker: crie o arquivo dele e acrescente uma linha aqui.
 * Contrato: { name, rps, rules?, create({ getJson, getText }) -> { fetchPage, toItem } }
 * A varredura e por `terms` (busca) ou por `pages` (listagem paginada).
 */
const SOURCES = [require('./torrentsCsv'), require('./redesTorrents')];

/** Tudo que o modulo declara segue adiante; so `create` e `rps` ficam aqui. */
function createSources(config) {
  return SOURCES.map(({ create, rps, ...source }) => {
    const http = createHttpClient({ rps, ...config.http });
    return { ...source, ...create(http) };
  });
}

/**
 * A TMDB nao e um tracker: nao indexa nada, so enriquece o que ja foi
 * indexado. Fica aqui por dividir o cliente HTTP com throttle e retry.
 * Sem chave configurada devolve null, e o enriquecimento e pulado.
 */
function createTmdbClient(config) {
  if (!config.tmdb.apiKey) return null;

  const { getJson } = createHttpClient({ rps: config.tmdb.rps, ...config.http });
  return createTmdb({
    getJson,
    apiKey: config.tmdb.apiKey,
    language: config.tmdb.language,
  });
}

module.exports = { createSources, createTmdbClient };
