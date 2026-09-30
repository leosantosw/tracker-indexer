'use strict';

const { readFile } = require('node:fs/promises');
const { join, extname } = require('node:path');

const WEB_DIST = join(__dirname, '..', '..', '..', '..', 'web', 'dist');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const ASSET = /^(?:[\w-]+\/)*[\w.-]+\.(?:js|css|png|svg|woff2?)$/;
const HASHED = /^assets\//;

function registerUiRoutes(app, { dir = WEB_DIST } = {}) {
  async function sendFile(reply, file) {
    try {
      const body = await readFile(join(dir, file));
      const cache = HASHED.test(file) ? 'public, max-age=31536000, immutable' : 'no-cache';
      return reply.type(TYPES[extname(file)]).header('cache-control', cache).send(body);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      if (file === 'index.html') {
        return reply.code(503).send({ error: 'painel nao compilado: rode npm run build' });
      }
      return reply.code(404).send({ error: 'arquivo nao encontrado' });
    }
  }

  const page = (_request, reply) => sendFile(reply, 'index.html');

  app.get('/', { schema: { hide: true } }, (_request, reply) => reply.redirect('/admin'));

  app.get('/admin', { schema: { hide: true } }, page);

  app.get('/admin/*', { schema: { hide: true } }, (request, reply) => {
    const path = request.params['*'];
    if (ASSET.test(path) && !path.includes('..')) return sendFile(reply, path);
    if (extname(path)) return reply.code(404).send({ error: 'arquivo nao encontrado' });
    return page(request, reply);
  });
}

module.exports = { registerUiRoutes };
