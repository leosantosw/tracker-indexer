'use strict';

const { DebridError } = require('../errors');
const { magnetOf } = require('../../lib/infohash');
const { createTorboxApi } = require('./api');
const { pickVideoFile, isFinished, hasFailed, progressOf, nameOf } = require('./files');

// A cached torrent becomes ready within a second of being added; wait that
// long before answering "downloading", so the TV gets the link on the first call.
const CACHED_READY_TRIES = 3;
const CACHED_READY_WAIT_MS = 700;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const notInDebrid = () => new DebridError('torrent nao esta no TorBox', 404, 'not_found');

function create({ token, timeoutMs, fetch, wait = sleep }) {
  const api = createTorboxApi({ token, timeoutMs, fetch });

  /** TorBox torrent -> our status. `ready` carries a link made just now. */
  async function describe(torrent) {
    if (hasFailed(torrent)) return { status: 'failed', reason: 'provider_failed', state: torrent.download_state };
    if (!isFinished(torrent)) return progressOf(torrent);

    const file = pickVideoFile(torrent.files);
    if (!file) return { status: 'failed', reason: 'no_video' };

    const url = await api.requestLink(torrent.id, file.id);
    return { status: 'ready', url, file: { name: nameOf(file), size: file.size ?? null } };
  }

  async function waitUntilReady(torrentId) {
    let torrent = null;
    for (let attempt = 0; attempt < CACHED_READY_TRIES; attempt++) {
      torrent = await api.getTorrent(torrentId);
      if (torrent && isFinished(torrent)) break;
      await wait(CACHED_READY_WAIT_MS);
    }
    return torrent;
  }

  return {
    /**
     * Idempotent: a torrent already in the account is only described. A new
     * one is added -- instantly ready when TorBox has it cached.
     */
    async resolve(hash) {
      const existing = await api.findByHash(hash);
      if (existing) return describe(existing);

      const cached = await api.isCached(hash);
      const created = await api.createTorrent(magnetOf(hash));

      // All download slots busy: TorBox queues it and there is no torrent id yet.
      if (created?.torrent_id === undefined) return { status: 'queued', cached };

      const torrent = cached ? await waitUntilReady(created.torrent_id) : await api.getTorrent(created.torrent_id);
      if (!torrent) return { ...progressOf({}), cached };
      return { ...(await describe(torrent)), cached };
    },

    /** Read only: never adds anything, so the TV can poll it freely. */
    async status(hash) {
      const torrent = await api.findByHash(hash);
      if (!torrent) throw notInDebrid();
      return describe(torrent);
    },

    async remove(hash) {
      const torrent = await api.findByHash(hash);
      if (!torrent) throw notInDebrid();
      await api.control(torrent.id, 'delete');
      return { removed: true };
    },
  };
}

module.exports = {
  id: 'torbox',
  label: 'TorBox',
  secret: 'torboxToken',
  create,
};
