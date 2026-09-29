'use strict';

const { now } = require('./items');

const UPSERT = `
  INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, ?)
  ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`;

function createState(db) {
  const upsert = db.prepare(UPSERT);
  const select = db.prepare('SELECT value FROM app_state WHERE key = ?');

  function readState(key) {
    const row = select.get(key);
    return row ? JSON.parse(row.value) : null;
  }

  const writeState = (key, value) => upsert.run(key, JSON.stringify(value), now());

  return { readState, writeState };
}

module.exports = { createState };
