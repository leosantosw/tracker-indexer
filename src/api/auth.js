'use strict';

const { timingSafeEqual } = require('node:crypto');

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function sameSecret(given, expected) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Header for fetch; query string for EventSource, which cannot send headers. */
function readToken(request) {
  const header = request.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);
  return request.query?.token ?? '';
}

/**
 * With a token, it is required. Without one, only localhost gets in.
 * `name` is the env var that sets the token, for the error message.
 */
function authorize(getToken, name) {
  return async (request, reply) => {
    const token = getToken();
    const allowed = token ? sameSecret(readToken(request), token) : LOOPBACK.has(request.ip);
    if (allowed) return;

    const error = token ? 'token invalido' : `sem ${name} esta rota so responde para localhost`;
    return reply.code(401).send({ error, tokenRequired: Boolean(token) });
  };
}

module.exports = { authorize };
