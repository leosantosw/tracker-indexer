'use strict';

const { transaction } = require('./index');

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
          PARTITION BY type, title, year, season, episode
          ORDER BY seeders DESC, id ASC
        ) AS pos
        FROM item WHERE source = ?1
      ) WHERE pos = 1
    )
`;

const UPSERT = `
  INSERT INTO item (
    source, source_id, infohash, name, raw_name, size_bytes, created_unix,
    seeders, leechers, created_at, updated_at,
    title, year, type, season, episode,
    resolution, release_source, video_codec, audio, hdr
  ) VALUES (
    @source, @sourceId, @infohash, @name, @rawName, @sizeBytes, @createdUnix,
    @seeders, @leechers, @now, @now,
    @title, @year, @type, @season, @episode,
    @resolution, @releaseSource, @videoCodec, @audio, @hdr
  )
  ON CONFLICT (source, source_id) DO UPDATE SET
    name         = excluded.name,
    seeders      = excluded.seeders,
    leechers     = excluded.leechers,
    updated_at   = excluded.updated_at,
    raw_name     = excluded.raw_name,
    title        = excluded.title,
    year         = excluded.year,
    type         = excluded.type,
    season       = excluded.season,
    episode      = excluded.episode,
    resolution   = excluded.resolution,
    release_source = excluded.release_source,
    video_codec  = excluded.video_codec,
    audio        = excluded.audio,
    hdr          = excluded.hdr
`;

function createItems(db) {
  const upsert = db.prepare(UPSERT);

  function countKnown(source, ids) {
    const marks = ids.map(() => '?').join(',');
    return db
      .prepare(`SELECT source_id FROM item WHERE source = ? AND source_id IN (${marks})`)
      .all(source, ...ids).length;
  }

  /** Grava a pagina inteira em uma transacao e devolve quantos eram novos. */
  function savePage(source, items) {
    if (!items.length) return 0;

    const ts = now();
    const inserted = items.length - countKnown(source, items.map((i) => i.sourceId));

    transaction(db, () => {
      for (const item of items) {
        upsert.run({
          source,
          sourceId: item.sourceId,
          infohash: item.infohash ?? null,
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
          episode: item.release.episode,
          resolution: item.release.resolution,
          releaseSource: item.release.source,
          videoCodec: item.release.videoCodec,
          audio: item.release.audio.join(', ') || null,
          hdr: item.release.hdr.join(', ') || null,
        });
      }
    });

    return inserted;
  }

  /**
   * Regras declaradas por tracker, sempre limitadas a `source`. Rodam no fim
   * da run e nao no insert porque duplicata chega por paginas e termos
   * diferentes -- so da para enxerga-la com a base inteira em maos.
   */
  function applyRules(source, rules = {}) {
    const removed = { noYear: 0, duplicate: 0 };
    if (!rules.requireYear && !rules.dedupe) return removed;

    transaction(db, () => {
      if (rules.requireYear) {
        removed.noYear = db
          .prepare('DELETE FROM item WHERE source = ? AND year IS NULL')
          .run(source).changes;
      }
      if (rules.dedupe === 'seeders') {
        removed.duplicate = db.prepare(DEDUPE_BY_SEEDERS).run(source).changes;
      }
    });

    return removed;
  }

  const stats = () =>
    db.prepare('SELECT source, COUNT(*) AS total FROM item GROUP BY source').all();

  const query = (sql) => {
    if (!/^\s*select\b/i.test(sql)) throw new Error('apenas SELECT e permitido');
    return db.prepare(sql).all();
  };

  return { savePage, applyRules, stats, query };
}

module.exports = { createItems, now };
