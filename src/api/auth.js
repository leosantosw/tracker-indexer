'use strict';

const { timingSafeEqual } = require('node:crypto');

function sameSecret(given, expected) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Header for fetch; query string for EventSource, which cannot send headers. */
function readToken(request) {
  const header = request.headers.authorization ?? '';
  if (header.startsWith('Bearer ')) return header.slice('Bearer '.length);
  return request.query?.token ?? '';
}

function authorize(getToken, name) {
  return async (request, reply) => {
    // CORS preflight carries no token and runs nothing: let it through.
    if (request.method === 'OPTIONS') return;
    const token = getToken();
    if (token && sameSecret(readToken(request), token)) return;

    if (!token) return reply.code(401).send({ error: `${name} nao configurado`, tokenRequired: false });
    return reply.code(401).send({ error: 'token invalido', tokenRequired: true });
  };
}

module.exports = { authorize };
