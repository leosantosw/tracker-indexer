'use strict';

const { createDebrid } = require('./index');

const TTL_MS = 10 * 60 * 1000;
// The movie detail waits for this at most; slower than that, it goes out without the flag.
const LOOKUP_TIMEOUT_MS = 1500;
// After a failure (provider down, token refused), stop asking for a while.
const BACKOFF_MS = 60 * 1000;

/**
 * "Is this torrent already cached on the debrid?" for the public movie detail.
 * Answers are kept in memory for a while: the detail is open to anyone, and
 * without this every visit would spend the account's rate limit. Only the
 * yes/no is kept -- never a link. Failures are not kept, so they are retried.
 */
function createCacheStatus({ store, ttlMs = TTL_MS, timeoutMs = LOOKUP_TIMEOUT_MS, backoffMs = BACKOFF_MS, now = Date.now }) {
  const known = new Map(); // hash -> { cached, at }
  let quietUntil = 0;

  // Another provider or token answers differently: start over.
  store.onChange(() => {
    known.clear();
    quietUntil = 0;
  });

  const fresh = (hash) => {
    const entry = known.get(hash);
    return entry && now() - entry.at < ttlMs ? entry : null;
  };

  /** { [hash]: true | false | null }; null when it could not be told. */
  async function lookup(hashes) {
    const result = Object.fromEntries(hashes.map((hash) => [hash, fresh(hash)?.cached ?? null]));
    const missing = hashes.filter((hash) => !fresh(hash));
    if (!missing.length || now() < quietUntil) return result;

    let debrid;
    try {
      debrid = createDebrid(store.config(), { timeoutMs });
    } catch {
      return result; // debrid off or without a token: nothing to ask
    }

    try {
      const answers = await debrid.checkCached(missing);
      for (const hash of missing) {
        known.set(hash, { cached: answers[hash], at: now() });
        result[hash] = answers[hash];
      }
    } catch {
      // Slow, down or refusing the token: null for these, and a pause before asking again.
      quietUntil = now() + backoffMs;
    }
    return result;
  }

  return { lookup };
}

module.exports = { createCacheStatus };
