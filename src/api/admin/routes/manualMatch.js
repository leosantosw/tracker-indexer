'use strict';

const { createTmdbClient } = require('../../../sources');
const { TMDB_SEARCH, MANUAL_MATCH } = require('../schemas');

const POSTER = 'https://image.tmdb.org/t/p/w92';
const MAX_RESULTS = 10;
const NO_KEY = { error: 'defina a TMDB_API_KEY em Configurações para buscar na TMDB' };

const toResult = ({ tmdbId, title, originalTitle, year, posterPath, overview }) => ({
  tmdbId,
  title,
  originalTitle,
  year,
  poster: posterPath ? POSTER + posterPath : null,
  overview,
});

function registerManualMatchRoutes(api, { repo, store, log }) {
  const tmdbClient = () => createTmdbClient(store.config());

  api.get('/tmdb/search', { schema: TMDB_SEARCH }, async (request, reply) => {
    const tmdb = tmdbClient();
    if (!tmdb) return reply.code(409).send(NO_KEY);

    try {
      const found = await tmdb.candidates(request.query.type, request.query.query);
      return { results: found.slice(0, MAX_RESULTS).map(toResult) };
    } catch (err) {
      return reply.code(502).send({ error: `TMDB: ${err.message}` });
    }
  });

  api.post('/works/:id/match', { schema: MANUAL_MATCH }, async (request, reply) => {
    const tmdb = tmdbClient();
    if (!tmdb) return reply.code(409).send(NO_KEY);

    const work = repo.workById(request.params.id);
    if (!work) return reply.code(404).send({ error: 'obra nao encontrada' });

    let result;
    try {
      result = await tmdb.lookup(work.type, request.body.tmdbId);
    } catch (err) {
      return reply.code(502).send({ error: `TMDB: ${err.message}` });
    }

    repo.saveWork(work, result);
    repo.setManualMatch(work.id, request.body.tmdbId);
    repo.refreshLeads();
    log(`tmdb: "${work.title}" casada manualmente com "${result.match.title}" (${result.match.year ?? 's/ ano'})`);
    return { title: result.match.title, year: result.match.year };
  });
}

module.exports = { registerManualMatchRoutes };
