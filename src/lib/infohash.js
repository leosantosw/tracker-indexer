'use strict';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const HEX = /^[0-9a-f]{40}$/i;

/** Some trackers publish the infohash in base32; the catalog uses hex. */
function base32ToHex(text) {
  let bits = '';
  for (const char of text.toUpperCase()) {
    const value = BASE32.indexOf(char);
    if (value < 0) return null;
    bits += value.toString(2).padStart(5, '0');
  }

  const bytes = bits.slice(0, 160).match(/.{8}/g) ?? [];
  if (bytes.length !== 20) return null;

  return bytes.map((b) => parseInt(b, 2).toString(16).padStart(2, '0')).join('');
}

/** Lowercase hex from either form, or null when it is not an infohash. */
function normalizeInfohash(raw) {
  const text = String(raw ?? '').trim();
  if (HEX.test(text)) return text.toLowerCase();
  return text.length === 32 ? base32ToHex(text) : null;
}

const magnetOf = (hash) => `magnet:?xt=urn:btih:${hash}`;

/** What a magnet link carries: infohash, release name (`dn`) and exact size (`xl`). */
function readMagnet(magnet) {
  const text = String(magnet ?? '');
  const param = (name) => (text.match(new RegExp(`[?&]${name}=([^&]*)`)) ?? [])[1] ?? null;

  const dn = param('dn');
  const xl = Number(param('xl'));

  return {
    infohash: normalizeInfohash((text.match(/btih:([a-zA-Z0-9]+)/) ?? [])[1]),
    name: dn ? decodeURIComponent(dn.replace(/\+/g, ' ')) : null,
    sizeBytes: Number.isFinite(xl) && xl > 0 ? xl : null,
  };
}

module.exports = { base32ToHex, normalizeInfohash, magnetOf, readMagnet };
