'use strict';

const { fold } = require('../lib/fold');
const { WITH_TORRENTS, HAS_TORRENTS, IS_LEAD } = require('./works');

const MAX_TERMS = 6;

const termsOf = (query) => (fold(query) ?? '').split(' ').filter(Boolean).slice(0, MAX_TERMS);

const eitherName = (param) => `(f.name LIKE @${param} OR f.alias LIKE @${param})`;

/**
 * Both the TMDB title and the torrent title are searched, folded, so "acao"
 * finds "Ação" and "homem aranha" finds "Homem-Aranha". A title that starts
 * with the query comes first, then one with a word that starts with it.
 */
function buildSearch({ terms, genres, type }) {
  const values = {};
  const inner = [`(w.status = 'ok' OR @all = 1)`, IS_LEAD, HAS_TORRENTS];
  const outer = ['1 = 1'];

  if (type) inner.push('w.type = @type');

  if (genres.length) {
    inner.push(`(${genres.map((_, n) => `', ' || w.genres || ', ' LIKE @genre${n}`).join(' OR ')})`);
    genres.forEach((genre, n) => (values[`genre${n}`] = `%, ${genre}, %`));
  }

  terms.forEach((term, n) => {
    outer.push(eitherName(`term${n}`));
    values[`term${n}`] = `% ${term}%`;
  });

  const phrase = terms.join(' ');
  values.starts = ` ${phrase}%`;
  values.word = `% ${phrase}%`;

  const found = `
    SELECT f.id, CASE WHEN ${eitherName('starts')} THEN 0 WHEN ${eitherName('word')} THEN 1 ELSE 2 END AS rank
    FROM (
      SELECT w.id, ' ' || fold(COALESCE(w.tmdb_title, w.title)) AS name, ' ' || fold(w.title) AS alias
      FROM work w WHERE ${inner.join(' AND ')}
    ) f
    WHERE ${outer.join(' AND ')}
  `;

  return { found, values };
}

const withoutUnused = (sql, values) =>
  Object.fromEntries(Object.entries(values).filter(([name]) => sql.includes(`@${name}`)));

function createSearch(db) {
  /** One list for movies and series; `genres` is any-of. */
  function searchWorks({ query = '', genres = [], type = null, page = 1, limit = 30, all = false }) {
    const terms = termsOf(query);
    const { found, values } = buildSearch({ terms, genres, type });
    const params = { ...values, type, all: all ? 1 : 0, limit, offset: (page - 1) * limit };

    const list = `
      SELECT w.*, COUNT(i.id) AS torrents, MAX(i.seeders) AS best_seeders, MAX(i.created_at) AS last_added
      FROM (${found}) s
      JOIN work w ON w.id = s.id
      ${WITH_TORRENTS}
      GROUP BY w.id
      ORDER BY s.rank ASC, w.votes DESC NULLS LAST, w.id DESC
      LIMIT @limit OFFSET @offset
    `;
    const count = `SELECT COUNT(*) AS total FROM (${found})`;

    return {
      rows: db.prepare(list).all(withoutUnused(list, params)),
      total: db.prepare(count).get(withoutUnused(count, params)).total,
    };
  }

  return { searchWorks };
}

module.exports = { createSearch };
