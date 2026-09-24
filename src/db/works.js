'use strict';

const { now } = require('./items');

/**
 * Item e obra se ligam pela chave de match, nao por FK. `IS` em vez de `=`
 * porque no SQLite NULL nao e igual a NULL, e obra sem ano existe em tracker
 * que nao tenha a regra `requireYear`.
 */
const ITEM_TO_WORK = 'i.type = w.type AND i.title = w.title AND i.year IS w.year';

/** Nota so conta com votacao suficiente -- a mesma regra para ordenar e exibir. */
const RATED = 'CASE WHEN w.votes >= @minVotes THEN w.rating END';

const WHERE_LISTAVEL = `WHERE w.type = @type AND w.status = 'ok'`;

// The genre column is a list ("Terror, Thriller"); the commas around it make
// the match exact, so "Terror" never matches "Terror psicológico".
const WHERE_GENRE = `AND ', ' || w.genres || ', ' LIKE @genre`;

/**
 * Ter nota vem antes de tudo -- nota qualquer, nao nota alta. Obra sem votacao
 * apurada cai para o fim da lista inteira, nao so do proprio ano.
 */
const ORDER = [
  `CASE WHEN ${RATED} IS NULL THEN 1 ELSE 0 END ASC`,
  'w.year DESC NULLS LAST',
  `${RATED} DESC`,
  'w.id DESC',
].join(', ');

/** Every order ends in `w.id`, so paging never repeats nor skips a work. */
const ORDERS = {
  default: ORDER,
  added: 'last_added DESC, w.id DESC',
  rating: `${RATED} DESC NULLS LAST, w.id DESC`,
};

/** O JOIN interno exclui obra que ficou sem nenhuma copia. */
const WORK_SELECT = `
  SELECT w.*,
         COUNT(i.id) AS torrents,
         MAX(i.seeders) AS best_seeders,
         MAX(i.created_at) AS last_added
  FROM work w
  JOIN item i ON ${ITEM_TO_WORK}
`;

const countListable = (genre) => `
  SELECT COUNT(*) AS total FROM (
    SELECT w.id FROM work w JOIN item i ON ${ITEM_TO_WORK} ${WHERE_LISTAVEL} ${genre ? WHERE_GENRE : ''} GROUP BY w.id
  )
`;

/** Genres of the listable works, one row per work; counting happens in JS. */
const GENRES_LISTAVEL = `
  SELECT w.genres FROM work w
  ${WHERE_LISTAVEL} AND w.genres IS NOT NULL
    AND EXISTS (SELECT 1 FROM item i WHERE ${ITEM_TO_WORK})
`;

const TORRENTS_OF_WORK = `
  SELECT i.* FROM item i
  JOIN work w ON ${ITEM_TO_WORK}
  WHERE w.id = ?
  ORDER BY i.seeders DESC, i.id ASC
`;

/**
 * Obras que o enrich ainda precisa ver: nunca consultadas, com nota velha ou
 * que nao casaram ha tempo suficiente para tentar de novo.
 */
const PENDING = `
  SELECT DISTINCT i.type, i.title, i.year, COALESCE(w.trailer_checked, 0) AS trailerChecked
  FROM item i
  LEFT JOIN work w ON ${ITEM_TO_WORK}
  WHERE i.title IS NOT NULL
    AND (
      w.id IS NULL
      OR (w.status = 'ok' AND w.checked_at < @staleBefore)
      OR (w.status IN ('not_found', 'ambiguous') AND w.checked_at < @retryBefore)
    )
  ORDER BY i.type, i.title
`;

const WORK_STATS = `
  SELECT w.status, COUNT(*) AS total FROM work w
  WHERE EXISTS (SELECT 1 FROM item i WHERE ${ITEM_TO_WORK})
  GROUP BY w.status
  ORDER BY total DESC
`;

const UPSERT = `
  INSERT INTO work (
    type, title, year, tmdb_id, tmdb_title, release_date, genres, overview,
    rating, votes, poster_path, backdrop_path, trailer_key, trailer_checked,
    status, checked_at
  ) VALUES (
    @type, @title, @year, @tmdbId, @tmdbTitle, @releaseDate, @genres, @overview,
    @rating, @votes, @posterPath, @backdropPath, @trailerKey, @trailerChecked,
    @status, @checkedAt
  )
  ON CONFLICT (type, title, year) DO UPDATE SET
    tmdb_id      = excluded.tmdb_id,
    tmdb_title   = excluded.tmdb_title,
    release_date = excluded.release_date,
    genres       = excluded.genres,
    overview     = excluded.overview,
    rating       = excluded.rating,
    votes        = excluded.votes,
    poster_path  = excluded.poster_path,
    backdrop_path = excluded.backdrop_path,
    trailer_key = COALESCE(excluded.trailer_key, work.trailer_key),
    trailer_checked = MAX(excluded.trailer_checked, work.trailer_checked),
    status      = excluded.status,
    checked_at  = excluded.checked_at
`;

/** Only the named parameters the SQL declares: node:sqlite rejects extras. */
const bind = (sql, values) =>
  Object.fromEntries(Object.entries(values).filter(([name]) => sql.includes(`@${name}`)));

function createWorks(db) {
  const upsert = db.prepare(UPSERT);

  /**
   * `minVotes` comes per call (editable from the panel), `genre` and `order`
   * come from the chosen category.
   */
  function listWorks(type, { page = 1, limit = 50, minVotes, genre = null, order = 'default' }) {
    const perPage = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const atual = Math.max(Number(page) || 1, 1);

    const values = {
      type,
      minVotes,
      genre: genre ? `%, ${genre}, %` : null,
      limit: perPage,
      offset: (atual - 1) * perPage,
    };

    const list =
      `${WORK_SELECT} ${WHERE_LISTAVEL} ${genre ? WHERE_GENRE : ''} GROUP BY w.id ` +
      `ORDER BY ${ORDERS[order] ?? ORDER} LIMIT @limit OFFSET @offset`;

    const rows = db.prepare(list).all(bind(list, values));
    const count = countListable(genre);
    const { total } = db.prepare(count).get(bind(count, values));

    return { rows, page: atual, limit: perPage, total };
  }

  /** How many listable works each genre has, most first. */
  function genreCounts(type) {
    const counts = new Map();
    for (const row of db.prepare(GENRES_LISTAVEL).all({ type })) {
      for (const genre of row.genres.split(', ')) counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
    return [...counts]
      .map(([genre, total]) => ({ genre, total }))
      .sort((a, b) => b.total - a.total || a.genre.localeCompare(b.genre, 'pt-BR'));
  }

  const getWork = (id, type) =>
    db.prepare(`${WORK_SELECT} WHERE w.id = ? AND w.type = ? GROUP BY w.id`).get(id, type);

  const listTorrents = (workId) => db.prepare(TORRENTS_OF_WORK).all(workId);

  const pendingWorks = (staleBefore, retryBefore = 0) => db.prepare(PENDING).all({ staleBefore, retryBefore });

  /** Grava tambem o fracasso: e o `status` que impede de reconsultar sempre. */
  function saveWork(work, result) {
    const match = result.match ?? {};
    upsert.run({
      type: work.type,
      title: work.title,
      year: work.year,
      tmdbId: match.tmdbId ?? null,
      tmdbTitle: match.title ?? null,
      releaseDate: match.releaseDate ?? null,
      genres: match.genres?.join(', ') || null,
      overview: match.overview ?? null,
      rating: match.rating ?? null,
      votes: match.votes ?? null,
      posterPath: match.posterPath ?? null,
      backdropPath: match.backdropPath ?? null,
      trailerKey: match.trailerKey ?? null,
      trailerChecked: match.trailerChecked ?? 0,
      status: result.status,
      checkedAt: now(),
    });
  }

  /** Only works that still have a torrent: orphans are TMDB cache, not catalog. */
  const workStats = () =>
    db.prepare(WORK_STATS).all();

  return { listWorks, genreCounts, getWork, listTorrents, pendingWorks, saveWork, workStats };
}

module.exports = { createWorks };
