'use strict';

const { createSources } = require('../sources');
const { DebridError } = require('./errors');

const ERRORS = {
  login: ['Não foi possível entrar no tracker. Confira a conta no painel.', 502, 'private_login_failed'],
  gone: ['Este torrent foi removido do tracker.', 404, 'private_torrent_gone'],
  not_freeleech: ['Este torrent não está mais em freeleech e ainda não está no cache.', 409, 'private_not_freeleech'],
  unavailable: ['O tracker não respondeu. Tente de novo em instantes.', 503, 'private_unavailable'],
};

function toDebridError(err) {
  if (err.code === 'blocked') return new DebridError(`O tracker não liberou o download: ${err.message}`, 409, 'private_download_blocked');
  const [message, statusCode, code] = ERRORS[err.code] ?? ERRORS.unavailable;
  return new DebridError(message, statusCode, code, { cause: err });
}

function createPrivateTorrents({ repo, store, log }) {
  function privateItemOf(hash, config) {
    const items = repo.itemsByInfohash(hash);
    const accessOf = (name) => config.sources.find((source) => source.name === name)?.access;
    if (!items.length || items.some((item) => accessOf(item.source) !== 'private')) return null;
    return items[0];
  }

  return function torrentFileFor(hash) {
    const config = store.config();
    const item = privateItemOf(hash, config);
    if (!item) return null;

    const source = createSources(config, { includeDisabled: true }).find((built) => built.name === item.source);
    if (!source?.torrentFile) return null;

    return async () => {
      try {
        return await source.torrentFile(item.sourceId);
      } catch (err) {
        log.warn(item.source, `.torrent de ${item.sourceId} recusado: ${err.message}`);
        throw toDebridError(err);
      }
    };
  };
}

module.exports = { createPrivateTorrents };
