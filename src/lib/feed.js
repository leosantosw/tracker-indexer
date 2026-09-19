'use strict';

const { EventEmitter } = require('node:events');

/**
 * In-memory event hub for the admin UI: keeps the last `size` log lines so a
 * page opened mid-run can catch up. Nothing is written to disk.
 */
function createFeed({ size = 500 } = {}) {
  const emitter = new EventEmitter().setMaxListeners(0);
  const lines = [];

  function publish(type, data) {
    emitter.emit('event', type, data);
  }

  function log(message) {
    const entry = { at: new Date().toISOString(), message };
    lines.push(entry);
    if (lines.length > size) lines.shift();
    publish('log', entry);
    return entry;
  }

  function subscribe(listener) {
    emitter.on('event', listener);
    return () => emitter.off('event', listener);
  }

  return { log, publish, subscribe, recent: () => [...lines] };
}

module.exports = { createFeed };
