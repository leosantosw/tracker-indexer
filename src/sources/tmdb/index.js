'use strict';

const { toCandidate, fromDetails, matchesAny, byPopularity } = require('./candidate');
const { pickMatch } = require('./movie');
const { pickSeries, titlesOf, withoutFranchise } = require('./series');
const { pickTrailer } = require('./trailer');
const { pickLogo } = require('./logo');

const BASE_URL = 'https://api.themoviedb.org';

const COLLECTION_RE =
  /\b(trilogia|quadrilogia|pentalogia|hexalogia|saga|colet[aâ]nea|cole[cç][aã]o|antologia)\b|\b\d\s*(?:e|ao?)\s*\d\s*$/i;

const PATHS = {
  movie: { search: '/3/search/movie', genres: '/3/genre/movie/list', detail: (id) => `/3/movie/${id}` },
  series: { search: '/3/search/tv', genres: '/3/genre/tv/list', detail: (id) => `/3/tv/${id}` },
};

const VIDEO_LANGUAGES = 'pt-BR,pt,en,null';
const IMAGE_LANGUAGES = 'pt,en,null';

function createTmdb({ getJson, apiKey, language }) {
  const genreCache = new Map();
  const detailCache = new Map();

  const url = (path) => {
    const built = new URL(path, BASE_URL);
    built.searchParams.set('api_key', apiKey);
    built.searchParams.set('language', language);
    return built;
  };

  async function genreNames(type) {
    if (!genreCache.has(type)) {
      const { genres = [] } = await getJson(url(PATHS[type].genres));
      genreCache.set(type, new Map(genres.map((genre) => [genre.id, genre.name])));
    }
    return genreCache.get(type);
  }

  async function find(type, query) {
    const names = await genreNames(type);
    const request = url(PATHS[type].search);
    request.searchParams.set('query', query);
    request.searchParams.set('include_adult', 'false');

    const { results = [] } = await getJson(request);
    return results.map((raw) => toCandidate(raw, type, names));
  }

  async function details(type, id) {
    const key = `${type}:${id}`;
    if (!detailCache.has(key)) {
      const request = url(PATHS[type].detail(id));
      request.searchParams.set('append_to_response', 'videos,images');
      request.searchParams.set('include_video_language', VIDEO_LANGUAGES);
      request.searchParams.set('include_image_language', IMAGE_LANGUAGES);
      detailCache.set(key, await getJson(request));
    }
    return detailCache.get(key);
  }

  const extrasOf = (raw) => ({
    trailerKey: pickTrailer(raw.videos?.results),
    trailerChecked: 1,
    logoPath: pickLogo(raw.images?.logos),
    logoChecked: 1,
  });

  const needsExtras = (work) => !work.trailerChecked || !work.logoChecked;

  const matched = (match, extras) => ({ status: 'ok', match: { ...match, ...extras } });

  async function searchMovie(work) {
    if (COLLECTION_RE.test(work.title)) return { status: 'skipped' };

    const found = pickMatch(await find('movie', work.title), work);
    if (found.status !== 'ok') return found;

    if (!needsExtras(work)) return matched(found.match, {});
    return matched(found.match, extrasOf(await details('movie', found.match.tmdbId)));
  }

  async function seriesCandidates(title) {
    const candidates = await find('series', title);
    const alternative = withoutFranchise(title);
    if (!alternative || candidates.some((candidate) => matchesAny(candidate, titlesOf(title)))) return candidates;
    return [...candidates, ...(await find('series', alternative))];
  }

  async function searchSeries(work) {
    const found = await pickSeries(await seriesCandidates(work.title), work, (id) => details('series', id));
    if (found.status !== 'ok') return found;

    return matched(found.match, needsExtras(work) ? extrasOf(found.details) : {});
  }

  const search = (work) => (work.type === 'series' ? searchSeries(work) : searchMovie(work));

  async function lookup(type, id) {
    const raw = await details(type, id);
    return matched(fromDetails(raw, type), extrasOf(raw));
  }

  async function findByImdb(type, imdbId) {
    const request = url(`/3/find/${encodeURIComponent(imdbId)}`);
    request.searchParams.set('external_source', 'imdb_id');
    const found = await getJson(request);

    if (type === 'movie') return found.movie_results?.[0]?.id ?? null;
    return (
      found.tv_results?.[0]?.id ?? found.tv_episode_results?.[0]?.show_id ?? found.tv_season_results?.[0]?.show_id ?? null
    );
  }

  const candidates = async (type, query) => (await find(type, query)).sort(byPopularity);

  return { search, lookup, findByImdb, candidates };
}

module.exports = { createTmdb, pickMatch, pickSeries, pickTrailer, pickLogo, toCandidate, COLLECTION_RE };
