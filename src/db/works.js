'use strict';

const { now } = require('./items');
const { REFRESH_LEADS } = require('./index');

/**
 * Item e obra se ligam pela chave de match, nao por FK. `IS` em vez de `=`
 * porque no SQLite NULL nao e igual a NULL, e obra sem ano existe em tracker
 * que nao tenha a regra `requireYear`.
 */
const WORK_YEAR = "CASE WHEN i.type = 'series' THEN NULL ELSE i.year END";

const itemOf = (alias) => `i.type = ${alias}.type AND i.title = ${alias}.title AND ${WORK_YEAR} IS ${alias}.year`;

const ITEM_TO_WORK = itemOf('w');

/**
 * The same TMDB title reached by different torrent names ("Escola De Rock",
 * "Escola de Rock") is one entry: the matched work with the lowest id leads,
 * and its siblings lend it their torrents.
 */
const IS_LEAD = 'w.id = w.lead_id';

const WITH_TORRENTS = `JOIN work m ON m.lead_id = w.lead_id JOIN item i ON ${itemOf('m')}`;

const HAS_TORRENTS = `EXISTS (SELECT 1 FROM work m JOIN item i ON ${itemOf('m')} WHERE m.lead_id = w.lead_id)`;

const LEAD_SELF = 'UPDATE work SET lead_id = id WHERE lead_id IS NULL';

/** Nota so conta com votacao suficiente -- a mesma regra para ordenar e exibir. */
const RATED = 'CASE WHEN w.votes >= @minVotes THEN w.rating END';

const WHERE_LISTAVEL = `WHERE w.type = @type AND w.status = 'ok'`;

// `all` also lists what the TMDB did not match (or never saw): no poster, title from the torrent.
const WHERE_LISTABLE_ALL = `WHERE w.type = @type AND (w.status = 'ok' OR @all = 1)`;

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
  ${WITH_TORRENTS}
`;

const countListable = (genre) => `
  SELECT COUNT(*) AS total FROM (
    SELECT w.id FROM work w ${WITH_TORRENTS} ${WHERE_LISTABLE_ALL} AND ${IS_LEAD} ${genre ? WHERE_GENRE : ''} GROUP BY w.id
  )
`;

/** Genres of the listable works, one row per work; counting happens in JS. */
const GENRES_LISTAVEL = `
  SELECT w.genres FROM work w
  ${WHERE_LISTAVEL} AND w.genres IS NOT NULL AND ${IS_LEAD} AND ${HAS_TORRENTS}
`;

/** The same infohash from two trackers is one copy: the most seeded one stays. */
const TORRENTS_OF_WORK = `
  SELECT i.*, MAX(COALESCE(i.seeders, -1)) AS best
  FROM work w ${WITH_TORRENTS}
  WHERE w.id = ?
  GROUP BY COALESCE(i.infohash, 'item:' || i.id)
  ORDER BY i.seeders DESC, i.id ASC
`;

/**
 * Every torrent's work exists as soon as the torrent does, TMDB or not: the
 * enrich only fills it in. `IS` because a work without a year is a real key.
 */
const REGISTER = `
  INSERT INTO work (type, title, year, status, checked_at)
  SELECT DISTINCT i.type, i.title, ${WORK_YEAR}, 'pending', 0 FROM item i
  WHERE i.title IS NOT NULL AND i.type IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM work w WHERE ${ITEM_TO_WORK})
`;

/**
 * Obras que o enrich ainda precisa ver: nunca consultadas, com nota velha ou
 * que nao casaram ha tempo suficiente para tentar de novo.
 */
const PENDING = `
  SELECT i.type, i.title, ${WORK_YEAR} AS year,
         COALESCE(MAX(w.trailer_checked), 0) AS trailerChecked,
         MAX(w.manual_tmdb_id) AS manualTmdbId,
         MAX(COALESCE(i.season_end, i.season)) AS maxSeason,
         GROUP_CONCAT(DISTINCT CASE
           WHEN i.season IS NOT NULL AND i.season_end IS NULL AND i.year IS NOT NULL
           THEN i.season || ':' || i.year
         END) AS seasonYears
  FROM item i
  LEFT JOIN work w ON ${ITEM_TO_WORK}
  WHERE i.title IS NOT NULL
    AND (
      w.id IS NULL
      OR w.status = 'pending'
      OR (w.status = 'ok' AND w.checked_at < @staleBefore)
      OR (w.status IN ('not_found', 'ambiguous') AND w.checked_at < @retryBefore)
    )
  GROUP BY i.type, i.title, ${WORK_YEAR}
  ORDER BY i.type, i.title
`;

const TYPE_STATS = `
  SELECT w.type, COUNT(*) AS total FROM work w
  WHERE ${IS_LEAD} AND ${HAS_TORRENTS}
  GROUP BY w.type
`;

const WORK_STATS = `
  SELECT w.status, COUNT(*) AS total FROM work w
  WHERE EXISTS (SELECT 1 FROM item i WHERE ${ITEM_TO_WORK})
  GROUP BY w.status
  ORDER BY total DESC
`;

const INSERT = `
  INSERT INTO work (
    type, title, year, tmdb_id, tmdb_title, release_date, genres, overview,
    rating, votes, poster_path, backdrop_path, trailer_key, trailer_checked,
    status, checked_at
  ) VALUES (
    @type, @title, @year, @tmdbId, @tmdbTitle, @releaseDate, @genres, @overview,
    @rating, @votes, @posterPath, @backdropPath, @trailerKey, @trailerChecked,
    @status, @checkedAt
  )
`;

/**
 * By key with `IS`, not ON CONFLICT: SQLite's UNIQUE never matches NULL, so a
 * work without a year would get a second row instead of being updated.
 */
const UPDATE = `
  UPDATE work SET
    tmdb_id      = @tmdbId,
    tmdb_title   = @tmdbTitle,
    release_date = @releaseDate,
    genres       = @genres,
    overview     = @overview,
    rating       = @rating,
    votes        = @votes,
    poster_path  = @posterPath,
    backdrop_path = @backdropPath,
    trailer_key = COALESCE(@trailerKey, trailer_key),
    trailer_checked = MAX(@trailerChecked, trailer_checked),
    status      = @status,
    checked_at  = @checkedAt
  WHERE type = @type AND title = @title AND year IS @year
`;

/** Only the named parameters the SQL declares: node:sqlite rejects extras. */
const bind = (sql, values) =>
  Object.fromEntries(Object.entries(values).filter(([name]) => sql.includes(`@${name}`)));

function createWorks(db) {
  const insert = db.prepare(INSERT);
  const update = db.prepare(UPDATE);

  /**
   * `minVotes` comes per call (editable from the panel), `genre` and `order`
   * come from the chosen category.
   */
  function listWorks(type, { page = 1, limit = 50, minVotes, genre = null, order = 'default', all = false }) {
    const perPage = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const atual = Math.max(Number(page) || 1, 1);

    const values = {
      type,
      minVotes,
      genre: genre ? `%, ${genre}, %` : null,
      all: all ? 1 : 0,
      limit: perPage,
      offset: (atual - 1) * perPage,
    };

    const list =
      `${WORK_SELECT} ${WHERE_LISTABLE_ALL} AND ${IS_LEAD} ${genre ? WHERE_GENRE : ''} GROUP BY w.id ` +
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

  const toHints = ({ maxSeason, seasonYears }) => ({
    maxSeason,
    seasonYears: (seasonYears ?? '')
      .split(',')
      .filter(Boolean)
      .map((pair) => pair.split(':').map(Number))
      .map(([season, year]) => ({ season, year })),
  });

  const pendingWorks = (staleBefore, retryBefore = 0) =>
    db
      .prepare(PENDING)
      .all({ staleBefore, retryBefore })
      .map(({ maxSeason, seasonYears, ...work }) => ({ ...work, hints: toHints({ maxSeason, seasonYears }) }));

  /** Creates the missing works, still `pending`; returns how many. */
  function registerWorks() {
    const { changes } = db.prepare(REGISTER).run();
    db.exec(LEAD_SELF);
    return changes;
  }

  const refreshLeads = () => db.exec(REFRESH_LEADS);

  /** Grava tambem o fracasso: e o `status` que impede de reconsultar sempre. */
  function saveWork(work, result) {
    const match = result.match ?? {};
    const values = {
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
    };
    if (!update.run(values).changes) {
      insert.run(values);
      db.exec(LEAD_SELF);
    }
  }

  /** Only works that still have a torrent: orphans are TMDB cache, not catalog. */
  const workStats = () =>
    db.prepare(WORK_STATS).all();

  const typeStats = () => db.prepare(TYPE_STATS).all();

  return { listWorks, genreCounts, getWork, listTorrents, pendingWorks, registerWorks, refreshLeads, saveWork, workStats, typeStats };
}

module.exports = { createWorks, WITH_TORRENTS, HAS_TORRENTS, IS_LEAD, ITEM_TO_WORK };
