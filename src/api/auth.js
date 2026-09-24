'use strict';

const { timingSafeEqual } = require('node:crypto');

const LOOPBACK_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

// Set by reverse proxies. Behind one on the same host every request comes
// from 127.0.0.1, so a forwarded request is never treated as local.
const FORWARDED = ['x-forwarded-for', 'x-real-ip', 'forwarded'];

function sameSecret(given, expected) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const hostnameOf = (request) => (request.headers.host ?? '').replace(/:\d+$/, '').toLowerCase();

const isLocal = (request) =>
  LOOPBACK_IPS.has(request.ip) &&
  LOOPBACK_HOSTS.has(hostnameOf(request)) &&
  !FORWARDED.some((header) => request.headers[header] !== undefined);

/** Header for fetch; query string for EventSource, which cannot send headers. */
function readToken(request) {
  const header = request.headers.authorization ?? '';
  if (header.startsWith('Bearer ')) return header.slice('Bearer '.length);
  if (header.startsWith('Basic ')) {
    const decoded = Buffer.from(header.slice('Basic '.length), 'base64').toString('utf8');
    return decoded.slice(decoded.indexOf(':') + 1);
  }
  return request.query?.token ?? '';
}

function authorize(getToken, name, { prompt = false } = {}) {
  return async (request, reply) => {
    // CORS preflight carries no token and runs nothing: let it through.
    if (request.method === 'OPTIONS') return;
    const token = getToken();
    if (token && sameSecret(readToken(request), token)) return;

    if (!token) return reply.code(401).send({ error: `${name} nao configurado`, tokenRequired: false });
    if (prompt) reply.header('www-authenticate', 'Basic realm="tracker-indexer", charset="UTF-8"');
    return reply.code(401).send({ error: 'token invalido', tokenRequired: true });
  };
}

module.exports = { authorize, isLocal };
