'use strict';

const baseConfig = require('../config');
const { createCipher } = require('../lib/secrets');
const { buildConfig, editableView, mergePatch } = require('./merge');
const { openSecrets, applySecrets, secretsStatus, sealSecrets } = require('./secrets');
const { SettingsError } = require('./errors');

/**
 * Effective config: code defaults, then `.env`, then what was saved in the
 * panel. Cached in memory and dropped on every write, so a change in the
 * panel applies to the next request or run without re-reading the table.
 * `onChange` listeners (the scheduler) hear about every write.
 */
function createSettingsStore(repo, { base = baseConfig } = {}) {
  const cipher = createCipher(base.secretsKey);
  let cache = null;
  const listeners = new Set();

  const changed = () => {
    cache = null;
    for (const listener of listeners) listener();
  };

  function load() {
    const saved = repo.readSettings();
    const secrets = openSecrets(saved.secrets, cipher);
    return {
      config: applySecrets(buildConfig(base, saved), secrets.values),
      secrets: secretsStatus(base, secrets, cipher),
    };
  }

  const current = () => (cache ??= load());

  function save(patch) {
    const saved = repo.readSettings();
    const sections = mergePatch(saved, patch);
    if (patch.secrets) sections.secrets = sealSecrets(saved.secrets, patch.secrets, cipher);

    repo.writeSettings(sections);
    changed();
  }

  /** Secrets survive a reset: each one has its own "remove". */
  function reset() {
    repo.resetSettings({ keep: ['secrets'] });
    changed();
  }

  return {
    config: () => current().config,
    view: () => ({ ...editableView(current().config), secrets: current().secrets }),
    save,
    reset,
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

module.exports = { createSettingsStore, SettingsError };
