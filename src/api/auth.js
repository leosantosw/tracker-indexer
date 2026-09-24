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

// Set by reverse proxies. Behind one on the same host every request comes
// from 127.0.0.1, so a forwarded request is never treated as local.
const FORWARDED = ['x-forwarded-for', 'x-real-ip', 'forwarded'];

const isLocal = (request) =>
  LOOPBACK.has(request.ip) && !FORWARDED.some((header) => request.headers[header] !== undefined);

/**
 * With a token, it is required. Without one, only localhost gets in.
 * `name` is the env var that sets the token, for the error message.
 */
function authorize(getToken, name) {
  return async (request, reply) => {
    // CORS preflight carries no token and runs nothing: let it through.
    if (request.method === 'OPTIONS') return;
    const token = getToken();
    const allowed = token ? sameSecret(readToken(request), token) : isLocal(request);
    if (allowed) return;

    const error = token ? 'token invalido' : `sem ${name} esta rota so responde para localhost`;
    return reply.code(401).send({ error, tokenRequired: Boolean(token) });
  };
}

module.exports = { authorize };
