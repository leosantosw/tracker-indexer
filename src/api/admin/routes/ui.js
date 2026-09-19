'use strict';

const { readFile } = require('node:fs/promises');
const { join, extname } = require('node:path');

const UI_DIR = join(__dirname, '..', '..', '..', 'ui');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
};

// Word-character segments only: no "..", no dotfiles, nothing outside src/ui.
const ASSET = /^(?:[\w-]+\/)*[\w-]+\.(?:js|css|png)$/;

/** Static files, read per request so editing the UI needs no restart. */
function registerUiRoutes(app) {
  const notFound = (reply) => reply.code(404).send({ error: 'arquivo nao encontrado' });

  async function sendFile(reply, file) {
    try {
      const body = await readFile(join(UI_DIR, file));
      return reply.type(TYPES[extname(file)]).send(body);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      return notFound(reply);
    }
  }

  app.get('/admin', { schema: { hide: true } }, (_request, reply) => sendFile(reply, 'index.html'));

  app.get('/admin/*', { schema: { hide: true } }, (request, reply) => {
    const asset = request.params['*'];
    return ASSET.test(asset) ? sendFile(reply, asset) : notFound(reply);
  });
}

module.exports = { registerUiRoutes };
