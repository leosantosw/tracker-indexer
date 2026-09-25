'use strict';

const { ITEM_TO_WORK } = require('./works');

const NAMES_PER_WORK = 3;

const UNMATCHED = "w.status IN ('not_found', 'ambiguous')";

const LIST = `
  SELECT w.id, w.type, w.title, w.year, w.status, w.checked_at AS checkedAt,
         COUNT(i.id) AS torrents,
         GROUP_CONCAT(DISTINCT i.source) AS sources,
         MAX(i.created_at) AS lastAdded
  FROM work w
  JOIN item i ON ${ITEM_TO_WORK}
  WHERE ${UNMATCHED} AND (@status IS NULL OR w.status = @status)
  GROUP BY w.id
  HAVING @source IS NULL OR SUM(i.source = @source) > 0
`;

const PAGE = `${LIST} ORDER BY lastAdded DESC, w.id DESC LIMIT @limit OFFSET @offset`;

const COUNT = `SELECT COUNT(*) AS total FROM (${LIST})`;

const BY_SOURCE = `
  SELECT i.source, COUNT(DISTINCT w.id) AS total
  FROM work w JOIN item i ON ${ITEM_TO_WORK}
  WHERE ${UNMATCHED}
  GROUP BY i.source
  ORDER BY total DESC
`;

const BY_STATUS = `
  SELECT w.status, COUNT(DISTINCT w.id) AS total
  FROM work w JOIN item i ON ${ITEM_TO_WORK}
  WHERE ${UNMATCHED}
  GROUP BY w.status
`;

const namesOf = (ids) => `
  SELECT w.id AS workId, i.source, i.raw_name AS rawName, i.seeders
  FROM work w JOIN item i ON ${ITEM_TO_WORK}
  WHERE w.id IN (${ids.map(() => '?').join(', ')})
  ORDER BY i.seeders DESC NULLS LAST, i.id DESC
`;

function groupNames(rows) {
  const byWork = new Map();
  for (const { workId, source, rawName } of rows) {
    const names = byWork.get(workId) ?? [];
    if (names.length < NAMES_PER_WORK && !names.some((name) => name.rawName === rawName)) names.push({ source, rawName });
    byWork.set(workId, names);
  }
  return byWork;
}

function createUnmatched(db) {
  function listUnmatched({ source = null, status = null, page = 1, limit = 20 } = {}) {
    const filter = { source, status };
    const rows = db.prepare(PAGE).all({ ...filter, limit, offset: (page - 1) * limit });
    const { total } = db.prepare(COUNT).get(filter);
    const names = rows.length ? groupNames(db.prepare(namesOf(rows.map((row) => row.id))).all(...rows.map((row) => row.id))) : new Map();

    return {
      works: rows.map(({ sources, lastAdded, ...row }) => ({
        ...row,
        sources: sources.split(','),
        lastAdded,
        names: names.get(row.id) ?? [],
      })),
      total,
    };
  }

  const workById = (id) => db.prepare('SELECT id, type, title, year FROM work WHERE id = ?').get(id);

  const setManualMatch = (id, tmdbId) => db.prepare('UPDATE work SET manual_tmdb_id = ? WHERE id = ?').run(tmdbId, id);

  const unmatchedCounts = () => ({
    bySource: db.prepare(BY_SOURCE).all(),
    byStatus: db.prepare(BY_STATUS).all(),
  });

  return { listUnmatched, unmatchedCounts, workById, setManualMatch };
}

module.exports = { createUnmatched };
