'use strict';

const fastify = require('fastify');

const config = require('../config');
const { registerDocs } = require('./docs');
const { SHARED, HEALTH, STATS, catalogRoutes } = require('./schemas');

const KB = 1024;

// O banco guarda so o caminho; o tamanho e escolhido aqui. Trocar w342 por
// w500 e uma linha, sem reprocessar nada.
const POSTER_BASE = 'https://image.tmdb.org/t/p/w342';
const BACKDROP_BASE = 'https://image.tmdb.org/t/p/w780';

const image = (base, path) => (path ? base + path : null);

// O banco guarda so o id do video; a URL do YouTube se monta aqui.
const YOUTUBE = 'https://www.youtube.com/watch?v=';

/** Tamanho legivel: GB acima de 1 GB, MB abaixo. */
function formatSize(bytes) {
  if (bytes === null || bytes === undefined) return null;
  const mb = bytes / (KB * KB);
  return mb >= KB ? `${(mb / KB).toFixed(2)} GB` : `${mb.toFixed(2)} MB`;
}

const isoDate = (unix) => new Date(unix * 1000).toISOString();

/**
 * A obra: o que vale para o filme inteiro, venha da TMDB ou da contagem.
 *
 * `release_date`, `last_added` e `status` ficam de fora de proposito -- a
 * ordenacao e o filtro usam essas colunas no SQL, nao no payload.
 */
const toWork = (row) => ({
  id: row.id,
  title: row.title,
  year: row.year,
  genres: row.genres ? row.genres.split(', ') : [],
  poster: image(POSTER_BASE, row.poster_path),
  backdrop: image(BACKDROP_BASE, row.backdrop_path),
  overview: row.overview,
  // Mesma regra do SQL: sem votacao suficiente, nao ha nota para divulgar.
  rating: row.votes >= config.tmdb.minVotes ? row.rating : null,
  votes: row.votes,
});

/**
 * O detalhe traz o que nao faz sentido repetir em cada linha da listagem:
 * o trailer e os numeros das copias.
 */
const toWorkDetail = (row) => ({
  ...toWork(row),
  trailer: row.trailer_key ? YOUTUBE + row.trailer_key : null,
  torrents: row.torrents,
  bestSeeders: row.best_seeders,
});

/** A copia: o que muda de release para release. O nome vem normalizado. */
const toTorrent = (row) => ({
  id: row.id,
  name: row.name,
  // season/episode so existem em serie; em filme sao sempre null.
  ...(row.type === 'series' ? { season: row.season, episode: row.episode } : {}),
  seeders: row.seeders,
  leechers: row.leechers,
  size: formatSize(row.size_bytes),
  resolution: row.resolution,
  release: row.release_source,
  videoCodec: row.video_codec,
  audio: row.audio,
  hdr: row.hdr,
  infohash: row.infohash,
  source: row.source,
  createdAt: isoDate(row.created_at),
  updatedAt: isoDate(row.updated_at),
});

/**
 * As tres rotas de um tipo. O tipo vem da rota, nunca da query: /movies so
 * responde por filme, inclusive no 404 de um id que existe mas e serie.
 */
function registerCatalog(app, repo, { path, type, key, schema }) {
  const notFound = (reply) => reply.code(404).send({ error: 'obra nao encontrada' });

  app.get(path, { schema: schema.list }, async (request) => {
    const { rows, page, limit, total } = repo.listWorks(type, request.query);

    return {
      [key]: rows.map(toWork),
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    };
  });

  app.get(`${path}/:id`, { schema: schema.detail }, async (request, reply) => {
    const found = repo.getWork(request.params.id, type);
    return found ? toWorkDetail(found) : notFound(reply);
  });

  app.get(`${path}/:id/torrents`, { schema: schema.torrents }, async (request, reply) => {
    if (!repo.getWork(request.params.id, type)) return notFound(reply);
    return { torrents: repo.listTorrents(request.params.id).map(toTorrent) };
  });
}

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

async function buildServer(repo) {
  const app = fastify();

  for (const schema of SHARED) app.addSchema(schema);
  await registerDocs(app);

  app.get('/health', { schema: HEALTH }, async () => ({ status: 'ok' }));

  app.get('/stats', { schema: STATS }, async () => ({
    sources: repo.stats(),
    works: repo.workStats(),
  }));

  for (const catalog of CATALOGS) registerCatalog(app, repo, catalog);

  return app;
}

module.exports = { buildServer };
