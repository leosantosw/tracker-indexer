'use strict';

const { now } = require('./items');
const { transaction } = require('./index');

const PENDING = `
  SELECT DISTINCT i.infohash FROM item i
  LEFT JOIN debrid_cache c ON c.provider = @provider AND c.infohash = i.infohash
  WHERE i.infohash IS NOT NULL
    AND (
      c.infohash IS NULL
      OR (c.cached = 1 AND c.checked_at < @cachedBefore)
      OR (c.cached = 0 AND c.checked_at < @missingBefore)
    )
  ORDER BY i.infohash
`;

const SAVE = `
  INSERT INTO debrid_cache (provider, infohash, cached, checked_at)
  VALUES (@provider, @infohash, @cached, @checkedAt)
  ON CONFLICT (provider, infohash) DO UPDATE SET cached = excluded.cached, checked_at = excluded.checked_at
`;

const FORGET_ORPHANS = `
  DELETE FROM debrid_cache
  WHERE NOT EXISTS (SELECT 1 FROM item i WHERE i.infohash = debrid_cache.infohash)
`;

const STATS = `
  SELECT i.source,
         COUNT(DISTINCT i.infohash) AS total,
         COUNT(DISTINCT c.infohash) AS checked,
         COUNT(DISTINCT CASE WHEN c.cached = 1 THEN c.infohash END) AS cached
  FROM item i
  LEFT JOIN debrid_cache c ON c.provider = @provider AND c.infohash = i.infohash
  WHERE i.infohash IS NOT NULL
  GROUP BY i.source
  ORDER BY i.source
`;

function createDebridCache(db) {
  const save = db.prepare(SAVE);

  const pendingCacheHashes = (provider, { cachedBefore, missingBefore }) =>
    db
      .prepare(PENDING)
      .all({ provider, cachedBefore, missingBefore })
      .map((row) => row.infohash);

  function saveCacheAnswers(provider, answers) {
    const checkedAt = now();
    const known = Object.entries(answers).filter(([, cached]) => typeof cached === 'boolean');
    transaction(db, () => {
      for (const [infohash, cached] of known) save.run({ provider, infohash, cached: cached ? 1 : 0, checkedAt });
    });
    return known.length;
  }

  function cachedByHash(provider, hashes) {
    if (!provider || !hashes.length) return {};
    const placeholders = hashes.map(() => '?').join(',');
    const rows = db
      .prepare(`SELECT infohash, cached FROM debrid_cache WHERE provider = ? AND infohash IN (${placeholders})`)
      .all(provider, ...hashes);
    return Object.fromEntries(rows.map((row) => [row.infohash, row.cached === 1]));
  }

  const forgetOrphanCache = () => db.prepare(FORGET_ORPHANS).run().changes;

  const cacheStats = (provider) => (provider ? db.prepare(STATS).all({ provider }) : []);

  return { pendingCacheHashes, saveCacheAnswers, cachedByHash, forgetOrphanCache, cacheStats };
}

module.exports = { createDebridCache };
