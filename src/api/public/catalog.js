'use strict';

const { catalogRoutes } = require('./schemas');
const { toWorkCard, toWorkDetail } = require('./dto');
const { findCategory } = require('./categories');
const { normalizeInfohash } = require('../../lib/infohash');

const CATALOGS = [
  {
    path: '/movies',
    type: 'movie',
    key: 'movies',
    schema: catalogRoutes('Movie', 'um filme', 'filmes'),
  },
  {
    path: '/series',
    type: 'series',
    key: 'series',
    schema: catalogRoutes('Series', 'uma série', 'séries'),
  },
];

/**
 * As duas rotas de um tipo. O tipo vem da rota, nunca da query: /movies so
 * responde por filme, inclusive no 404 de um id que existe mas e serie.
 */
function registerCatalog(app, { repo, store, cacheStatus }, { path, type, key, schema }) {
  const notFound = (reply) => reply.code(404).send({ error: 'obra nao encontrada' });
  const minVotes = () => store.config().tmdb.minVotes;

  app.get(path, { schema: schema.list }, async (request, reply) => {
    const votes = minVotes();
    const { category: id, ...query } = request.query;

    // A category is a saved filter: it decides what enters the list and in which order.
    const category = id ? findCategory(repo, type, id) : null;
    if (id && !category) return reply.code(404).send({ error: 'categoria nao encontrada' });

    const { rows, page, limit, total } = repo.listWorks(type, {
      ...query,
      minVotes: votes,
      genre: category?.genre ?? null,
      order: category?.order ?? 'default',
    });

    return {
      [key]: rows.map((row) => toWorkCard(row, votes)),
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    };
  });

  app.get(`${path}/:id`, { schema: schema.detail }, async (request, reply) => {
    const found = repo.getWork(request.params.id, type);
    if (!found) return notFound(reply);
    const torrents = repo.listTorrents(found.id);
    const hashes = torrents.map((torrent) => normalizeInfohash(torrent.infohash)).filter(Boolean);
    const cachedByHash = hashes.length ? await cacheStatus.lookup(hashes) : {};
    return toWorkDetail(found, minVotes(), torrents, cachedByHash);
  });
}

const registerCatalogs = (app, deps) => CATALOGS.forEach((catalog) => registerCatalog(app, deps, catalog));

module.exports = { registerCatalogs };
