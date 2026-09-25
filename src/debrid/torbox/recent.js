'use strict';

const KEEP_MS = 10 * 60 * 1000;

function createRecent({ keepMs = KEEP_MS, now = Date.now } = {}) {
  const added = new Map();

  function idOf(hash) {
    const entry = added.get(hash);
    if (!entry) return null;
    if (now() - entry.at > keepMs) {
      added.delete(hash);
      return null;
    }
    return entry.id;
  }

  return {
    remember: (hash, id) => added.set(hash, { id, at: now() }),
    forget: (hash) => added.delete(hash),
    idOf,
  };
}

module.exports = { createRecent, shared: createRecent() };
