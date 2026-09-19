'use strict';

const { transaction } = require('./index');
const { now } = require('./items');

const UPSERT = `
  INSERT INTO setting (key, value, updated_at) VALUES (?, ?, ?)
  ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`;

/** Key/value store for the admin overrides. Each value is a JSON section. */
function createSettings(db) {
  const upsert = db.prepare(UPSERT);

  const readSettings = () =>
    Object.fromEntries(
      db
        .prepare('SELECT key, value FROM setting')
        .all()
        .map((row) => [row.key, JSON.parse(row.value)])
    );

  function writeSettings(sections) {
    const ts = now();
    transaction(db, () => {
      for (const [key, value] of Object.entries(sections)) upsert.run(key, JSON.stringify(value), ts);
    });
  }

  function resetSettings({ keep = [] } = {}) {
    const marks = keep.map(() => '?').join(',');
    db.prepare(`DELETE FROM setting ${keep.length ? `WHERE key NOT IN (${marks})` : ''}`).run(...keep);
  }

  return { readSettings, writeSettings, resetSettings };
}

module.exports = { createSettings };
