'use strict';

const { catalogRoutes } = require('./schemas');
const { toWorkCard, toWorkDetail } = require('./dto');

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
function registerCatalog(app, { repo, store }, { path, type, key, schema }) {
  const notFound = (reply) => reply.code(404).send({ error: 'obra nao encontrada' });
  const minVotes = () => store.config().tmdb.minVotes;

  app.get(path, { schema: schema.list }, async (request) => {
    const votes = minVotes();
    const { rows, page, limit, total } = repo.listWorks(type, { ...request.query, minVotes: votes });

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
    return toWorkDetail(found, minVotes(), repo.listTorrents(found.id));
  });
}

const registerCatalogs = (app, deps) => CATALOGS.forEach((catalog) => registerCatalog(app, deps, catalog));

module.exports = { registerCatalogs };
