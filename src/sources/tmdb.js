'use strict';

const { matchable } = require('../lib/classifier/normalize');

const BASE_URL = 'https://api.themoviedb.org';

/**
 * Coletanea nao e uma obra: nao existe "Hexalogia Star Wars" na TMDB. Buscar
 * so gastaria requisicao para trazer um match errado.
 */
const COLLECTION_RE = /\b(trilogia|quadrilogia|pentalogia|hexalogia|saga|colet[aâ]nea|cole[cç][aã]o|antologia)\b|\b\d\s*(?:e|ao?)\s*\d\s*$/i;

/** So confia em titulo identico depois de normalizado: sem acento, sem pontuacao. */
const same = (a, b) => Boolean(a) && Boolean(b) && matchable(a) === matchable(b);

const year = (date) => (date ? Number(String(date).slice(0, 4)) : null);

/** Filme e serie tem campos com nomes diferentes; daqui para baixo e um so. */
const toCandidate = (raw, type, genreNames = new Map()) => {
  // "2026-03-14" -- guardada inteira; e a data confiavel, o ano do release e
  // so o que coube no nome do torrent.
  const date = (type === 'movie' ? raw.release_date : raw.first_air_date) || null;

  return {
  tmdbId: raw.id,
  title: type === 'movie' ? raw.title : raw.name,
  originalTitle: type === 'movie' ? raw.original_title : raw.original_name,
  releaseDate: date,
  year: year(date),
  // A busca devolve so os ids; o nome vem do dicionario de generos da TMDB.
  genres: (raw.genre_ids ?? []).map((id) => genreNames.get(id)).filter(Boolean),
  overview: raw.overview || null,
  rating: raw.vote_average ?? null,
  votes: raw.vote_count ?? null,
  posterPath: raw.poster_path || null,
  backdropPath: raw.backdrop_path || null,
  popularity: raw.popularity ?? 0,
  };
};

const byPopularity = (a, b) => b.popularity - a.popularity;

/**
 * Escolhe um trailer entre dezenas de videos (clipe, bastidor, featurette).
 * Trailer vale mais que teaser, dublado vale mais que legendado, e oficial
 * desempata. Abaixo de teaser nada serve -- clipe de 30s nao e trailer.
 */
const trailerScore = (v) =>
  (v.type === 'Trailer' ? 100 : v.type === 'Teaser' ? 50 : 0) +
  (v.iso_639_1 === 'pt' ? 20 : 0) +
  (v.official ? 5 : 0);

function pickTrailer(videos = []) {
  const best = videos
    .filter((v) => v.site === 'YouTube' && v.key && trailerScore(v) >= 50)
    .sort((a, b) => trailerScore(b) - trailerScore(a))[0];

  return best?.key ?? null;
}

/**
 * Decide se algum candidato e confiavel. Capa errada e pior que capa nenhuma,
 * entao na duvida devolve `ambiguous` e o item fica sem enriquecer.
 *
 * Com ano, ele e a prova: +-1 porque a TMDB guarda a estreia original e o
 * release brasileiro costuma usar o ano da estreia daqui, que atrasa.
 *
 * Sem ano, a prova e o titulo exato -- e, havendo empate, a distancia de
 * popularidade: "O Poderoso Chefao" ganha do homonimo por ordens de grandeza,
 * "Anne" nao ganha de nada.
 */
function pickMatch(candidates, work) {
  if (!candidates.length) return { status: 'not_found' };

  const exact = candidates.filter(
    (c) => same(c.title, work.title) || same(c.originalTitle, work.title)
  );

  if (work.year !== null) {
    const pool = (exact.length ? exact : candidates)
      .filter((c) => c.year !== null && Math.abs(c.year - work.year) <= 1)
      .sort(byPopularity);

    return pool.length ? { status: 'ok', match: pool[0] } : { status: 'ambiguous' };
  }

  if (!exact.length) return { status: 'ambiguous' };

  const [first, second] = exact.sort(byPopularity);
  if (exact.length === 1 || first.popularity >= 2 * second.popularity) {
    return { status: 'ok', match: first };
  }
  return { status: 'ambiguous' };
}

/** `getJson` ja vem com throttle e retry; aqui so se monta a URL. */
function createTmdb({ getJson, apiKey, language }) {
  const endpoint = (type) => (type === 'movie' ? '/3/search/movie' : '/3/search/tv');

  const url = (path) => {
    const built = new URL(path, BASE_URL);
    built.searchParams.set('api_key', apiKey);
    built.searchParams.set('language', language);
    return built;
  };

  /**
   * Dicionario de generos, uma vez por execucao e por tipo -- sao duas
   * requisicoes na run inteira, nao uma por obra.
   */
  const genreCache = new Map();

  async function genreNames(type) {
    if (genreCache.has(type)) return genreCache.get(type);

    const { genres = [] } = await getJson(url(`/3/genre/${type === 'movie' ? 'movie' : 'tv'}/list`));
    const names = new Map(genres.map((g) => [g.id, g.name]));

    genreCache.set(type, names);
    return names;
  }

  /**
   * O ano nao vai na query de proposito: o filtro da TMDB e exato e cortaria o
   * match legitimo que escorregou um ano. Melhor receber tudo e conferir aqui.
   */
  async function search(work) {
    // Antes de qualquer requisicao: coletanea nao existe na TMDB.
    if (COLLECTION_RE.test(work.title)) return { status: 'skipped' };

    const names = await genreNames(work.type);

    const query = url(endpoint(work.type));
    query.searchParams.set('query', work.title);
    query.searchParams.set('include_adult', 'false');

    const { results = [] } = await getJson(query);
    const found = pickMatch(results.map((raw) => toCandidate(raw, work.type, names)), work);

    if (found.status !== 'ok') return found;

    // Trailer nao muda: procurado uma vez por obra e nunca mais, mesmo quando
    // a nota e revalidada. E o que impede a revalidacao de custar o dobro.
    const trailerKey = work.trailerChecked ? null : await trailer(found.match.tmdbId, work.type);

    return { ...found, match: { ...found.match, trailerKey, trailerChecked: 1 } };
  }

  /**
   * O unico dado que custa requisicao propria: a busca nao traz video nenhum.
   * So vale a pena para obra que casou, e por isso vem depois do `pickMatch`.
   */
  async function trailer(tmdbId, type) {
    const detail = url(`/3/${type === 'series' ? 'tv' : 'movie'}/${tmdbId}`);
    detail.searchParams.set('append_to_response', 'videos');
    detail.searchParams.set('include_video_language', 'pt-BR,pt,en,null');

    try {
      const { videos } = await getJson(detail);
      return pickTrailer(videos?.results);
    } catch {
      // Trailer e acessorio: perder um nao pode invalidar o match inteiro.
      return null;
    }
  }

  return { search };
}

module.exports = { createTmdb, pickMatch, pickTrailer, toCandidate, COLLECTION_RE };
