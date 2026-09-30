'use strict';

const { transaction } = require('./index');
const { NAMED_RESOLUTIONS, OTHER_RESOLUTION } = require('../sources/resolution');
const { GB } = require('../sources/sizeLimit');

const now = () => Math.floor(Date.now() / 1000);

/**
 * Mesma obra = mesma (type, title, year, season, episode). Sobra a copia com
 * mais seeders; empate fica com a mais antiga, para a escolha nao oscilar
 * entre runs. Em PARTITION BY o SQLite agrupa NULL com NULL, que e o que se
 * quer: filme tem season/episode nulos e mesmo assim compete entre si.
 */
const DEDUPE_BY_SEEDERS = `
  DELETE FROM item
  WHERE source = ?1
    AND id NOT IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY type, title, year, season, season_end, episode, episode_end, language
          ORDER BY seeders DESC, id ASC
        ) AS pos
        FROM item WHERE source = ?1
      ) WHERE pos = 1
    )
`;

/**
 * A copy that would lose the dedupe to one already kept. Skipping it at the
 * insert keeps it from coming back as "new" on every run only to be deleted.
 * Ties go to the stored copy, the older one -- same as DEDUPE_BY_SEEDERS.
 */
const BEATEN = `
  SELECT 1 FROM item
  WHERE source = @source AND source_id <> @sourceId
    AND type IS @type AND title IS @title AND year IS @year
    AND season IS @season AND season_end IS @seasonEnd
    AND episode IS @episode AND episode_end IS @episodeEnd
    AND language IS @language
    AND seeders >= @seeders
  LIMIT 1
`;

const NAMED_LIST = NAMED_RESOLUTIONS.map((resolution) => `'${resolution}'`).join(', ');

const OUTSIDE_RESOLUTIONS = `
  DELETE FROM item
  WHERE source = ?
    AND (CASE WHEN resolution IN (${NAMED_LIST}) THEN resolution ELSE '${OTHER_RESOLUTION}' END)
        NOT IN (SELECT value FROM json_each(?))
`;

const OVER_SIZE_LIMIT = `
  DELETE FROM item
  WHERE source = @source
    AND size_bytes > 0
    AND CASE
      WHEN type IS NOT 'series' THEN size_bytes > @movie
      WHEN episode IS NOT NULL THEN size_bytes > @episode * MAX(1, COALESCE(episode_end, episode) - episode + 1)
      ELSE size_bytes > @season * MAX(1, COALESCE(season_end, season, 1) - COALESCE(season, 1) + 1)
    END
`;

const limitInBytes = (gigabytes) => (gigabytes === null || gigabytes === undefined ? null : gigabytes * GB);

const UPSERT = `
  INSERT INTO item (
    source, source_id, infohash, imdb_id, name, raw_name, size_bytes, created_unix,
    seeders, leechers, created_at, updated_at,
    title, year, type, season, season_end, episode, episode_end,
    resolution, release_source, video_codec, audio, hdr, language
  ) VALUES (
    @source, @sourceId, @infohash, @imdbId, @name, @rawName, @sizeBytes, @createdUnix,
    @seeders, @leechers, @now, @now,
    @title, @year, @type, @season, @seasonEnd, @episode, @episodeEnd,
    @resolution, @releaseSource, @videoCodec, @audio, @hdr, @language
  )
  ON CONFLICT (source, source_id) DO UPDATE SET
    imdb_id      = COALESCE(excluded.imdb_id, imdb_id),
    name         = excluded.name,
    seeders      = excluded.seeders,
    leechers     = excluded.leechers,
    updated_at   = excluded.updated_at,
    raw_name     = excluded.raw_name,
    title        = excluded.title,
    year         = excluded.year,
    type         = excluded.type,
    season       = excluded.season,
    season_end   = excluded.season_end,
    episode      = excluded.episode,
    episode_end  = excluded.episode_end,
    resolution   = excluded.resolution,
    release_source = excluded.release_source,
    video_codec  = excluded.video_codec,
    audio        = excluded.audio,
    hdr          = excluded.hdr,
    language     = excluded.language
`;

function createItems(db) {
  const upsert = db.prepare(UPSERT);
  const beaten = db.prepare(BEATEN);

  function knownIds(source, ids) {
    if (!ids.length) return new Set();
    const marks = ids.map(() => '?').join(',');
    const rows = db
      .prepare(`SELECT source_id FROM item WHERE source = ? AND source_id IN (${marks})`)
      .all(source, ...ids);
    return new Set(rows.map((row) => row.source_id));
  }

  const languageOf = (item) => item.release.language ?? item.language ?? null;

  const isBeaten = (source, item) =>
    item.seeders !== null &&
    item.seeders !== undefined &&
    Boolean(
      beaten.get({
        source,
        sourceId: item.sourceId,
        type: item.release.type,
        title: item.release.title || null,
        year: item.release.year,
        season: item.release.season,
        seasonEnd: item.release.seasonEnd ?? null,
        episode: item.release.episode,
        episodeEnd: item.release.episodeEnd ?? null,
        language: languageOf(item),
        seeders: item.seeders,
      })
    );

  /** Grava a pagina inteira em uma transacao e devolve quantos eram novos. */
  function savePage(source, items, rules = {}) {
    if (!items.length) return 0;

    const ts = now();
    const known = knownIds(source, items.map((i) => i.sourceId));
    const fresh = items.filter((item) => !known.has(item.sourceId));
    const skipped = rules.dedupe === 'seeders' ? new Set(fresh.filter((item) => isBeaten(source, item))) : new Set();

    transaction(db, () => {
      for (const item of items) {
        if (skipped.has(item)) continue;
        upsert.run({
          source,
          sourceId: item.sourceId,
          infohash: item.infohash ?? null,
          imdbId: item.imdbId ?? null,
          name: item.release.canonical || item.name,
          rawName: item.name,
          sizeBytes: item.sizeBytes ?? null,
          createdUnix: item.createdUnix ?? null,
          seeders: item.seeders ?? null,
          leechers: item.leechers ?? null,
          now: ts,
          title: item.release.title || null,
          year: item.release.year,
          type: item.release.type,
          season: item.release.season,
          seasonEnd: item.release.seasonEnd ?? null,
          episode: item.release.episode,
          episodeEnd: item.release.episodeEnd ?? null,
          resolution: item.release.resolution,
          releaseSource: item.release.source,
          videoCodec: item.release.videoCodec,
          audio: item.release.audio.join(', ') || null,
          hdr: item.release.hdr.join(', ') || null,
          language: languageOf(item),
        });
      }
    });

    return fresh.length - skipped.size;
  }

  /**
   * Regras declaradas por tracker, sempre limitadas a `source`. Rodam no fim
   * da run e nao no insert porque duplicata chega por paginas e termos
   * diferentes -- so da para enxerga-la com a base inteira em maos.
   */
  function applyRules(source, rules = {}, { resolutions = null, maxSizeGb = null } = {}) {
    const removed = { noYear: 0, duplicate: 0, resolution: 0, size: 0 };
    if (!rules.requireYear && !rules.dedupe && !resolutions && !maxSizeGb) return removed;

    transaction(db, () => {
      if (rules.requireYear) {
        removed.noYear = db
          .prepare("DELETE FROM item WHERE source = ? AND type = 'movie' AND year IS NULL")
          .run(source).changes;
      }
      if (rules.dedupe === 'seeders') {
        removed.duplicate = db.prepare(DEDUPE_BY_SEEDERS).run(source).changes;
      }
      if (resolutions) {
        removed.resolution = db.prepare(OUTSIDE_RESOLUTIONS).run(source, JSON.stringify(resolutions)).changes;
      }
      if (maxSizeGb) {
        removed.size = db.prepare(OVER_SIZE_LIMIT).run({
          source,
          movie: limitInBytes(maxSizeGb.movie),
          episode: limitInBytes(maxSizeGb.episode),
          season: limitInBytes(maxSizeGb.season),
        }).changes;
      }
    });

    return removed;
  }

  /** Every torrent of one tracker. Works stay: they are the TMDB cache. */
  const clearSource = (source) => db.prepare('DELETE FROM item WHERE source = ?').run(source).changes;

  const stats = () =>
    db.prepare('SELECT source, COUNT(*) AS total FROM item GROUP BY source').all();

  const query = (sql) => {
    if (!/^\s*select\b/i.test(sql)) throw new Error('apenas SELECT e permitido');
    return db.prepare(sql).all();
  };

  const itemsByInfohash = (infohash) =>
    db.prepare('SELECT source, source_id AS sourceId FROM item WHERE infohash = ? ORDER BY id').all(infohash);

  return { savePage, applyRules, clearSource, stats, query, knownSourceIds: knownIds, itemsByInfohash };
}

module.exports = { createItems, now };
