'use strict';

const { DatabaseSync } = require('node:sqlite');
const { mkdirSync } = require('node:fs');
const { dirname } = require('node:path');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS item (
  id            INTEGER PRIMARY KEY,
  source        TEXT NOT NULL,
  source_id     TEXT NOT NULL,
  infohash      TEXT,
  name          TEXT NOT NULL,
  raw_name      TEXT NOT NULL,
  title         TEXT,
  year          INTEGER,
  type          TEXT,
  season        INTEGER,
  episode       INTEGER,
  resolution    TEXT,
  release_source TEXT,
  video_codec   TEXT,
  audio         TEXT,
  hdr           TEXT,
  size_bytes    INTEGER,
  created_unix  INTEGER,
  seeders       INTEGER,
  leechers      INTEGER,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  UNIQUE (source, source_id)
);

-- A obra em si, uma linha por (type, title, year) -- nao por torrent.
-- Sinopse, nota e capa pertencem ao filme; seeders e resolucao, a copia.
CREATE TABLE IF NOT EXISTS work (
  id          INTEGER PRIMARY KEY,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  year        INTEGER,
  tmdb_id     INTEGER,
  tmdb_title  TEXT,
  release_date TEXT,   -- "2026-03-14" da TMDB; mais confiavel que o ano do release
  genres      TEXT,    -- "Terror, Suspense" -- mesma convencao de audio/hdr em item
  overview    TEXT,
  rating      REAL,
  votes       INTEGER,
  poster_path TEXT,    -- vertical, para a grade
  backdrop_path TEXT,  -- horizontal, para banner e fundo
  trailer_key TEXT,    -- id do video no YouTube; a URL e montada na API
  trailer_checked INTEGER NOT NULL DEFAULT 0,  -- 1 = ja procurou, achando ou nao
  status      TEXT NOT NULL,   -- ok | not_found | ambiguous | skipped
  checked_at  INTEGER NOT NULL,
  UNIQUE (type, title, year)
);

-- Overrides saved from the admin UI; a missing key falls back to code/env defaults.
CREATE TABLE IF NOT EXISTS setting (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_item_created ON item (created_unix DESC);
CREATE INDEX IF NOT EXISTS ix_item_seeders ON item (seeders DESC);
CREATE INDEX IF NOT EXISTS ix_item_title   ON item (title);
CREATE INDEX IF NOT EXISTS ix_item_added   ON item (created_at DESC);
-- The item -> work join (type, title, year) used by every listing.
CREATE INDEX IF NOT EXISTS ix_item_work    ON item (type, title, year);
CREATE INDEX IF NOT EXISTS ix_work_status  ON work (status, checked_at);
`;

/**
 * O `CREATE TABLE IF NOT EXISTS` nao altera tabela que ja existe, entao coluna
 * nova precisa de ALTER. Cada entrada roda no maximo uma vez -- quem decide e
 * o proprio banco, pelo `PRAGMA table_info`.
 *
 * `reset` serve para coluna que o enrich preenche: zerar `checked_at` invalida
 * o cache e a proxima execucao busca o dado que faltava, sem flag nem comando
 * especial.
 */
const MIGRATIONS = [
  {
    table: 'work',
    column: 'release_date',
    ddl: 'ALTER TABLE work ADD COLUMN release_date TEXT',
    reset: 'UPDATE work SET checked_at = 0',
  },
  {
    table: 'work',
    column: 'genres',
    ddl: 'ALTER TABLE work ADD COLUMN genres TEXT',
    reset: 'UPDATE work SET checked_at = 0',
  },
  {
    table: 'work',
    column: 'backdrop_path',
    ddl: 'ALTER TABLE work ADD COLUMN backdrop_path TEXT',
    reset: 'UPDATE work SET checked_at = 0',
  },
  {
    table: 'work',
    column: 'trailer_key',
    ddl: 'ALTER TABLE work ADD COLUMN trailer_key TEXT',
    reset: 'UPDATE work SET checked_at = 0',
  },
  // Sem `reset`: a coluna acima ja invalidou o cache, e a proxima execucao
  // busca o trailer de todo mundo. Depois disso ninguem mais procura.
  {
    table: 'work',
    column: 'trailer_checked',
    ddl: 'ALTER TABLE work ADD COLUMN trailer_checked INTEGER NOT NULL DEFAULT 0',
  },
];

function migrate(db) {
  for (const { table, column, ddl, reset } of MIGRATIONS) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    if (columns.some((c) => c.name === column)) continue;

    db.exec(ddl);
    if (reset) db.exec(reset);
  }
}

function openDb(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });

  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

function transaction(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

module.exports = { openDb, transaction };
