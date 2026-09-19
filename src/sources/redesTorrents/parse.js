'use strict';

const { base32ToHex, normalizeInfohash } = require('../../lib/infohash');

/**
 * Extracao por regex, sem dependencia. Frageis por natureza: se o template do
 * site mudar, param de achar e o source passa a indexar zero -- por isso o
 * `fetchPage` avisa no log quando uma pagina nao rende nenhum magnet.
 */

const CARD = /<a\s+href="([^"]+)"\s+class="[^"]*cover-link"[\s\S]*?<article[^>]*>/g;
const ATTR = (html, name) => (html.match(new RegExp(`data-${name}="([^"]*)"`)) || [])[1] ?? null;

const MAGNET = /magnet:\?[^"'<\s]+/;
const SIZE = /<small>Tamanho do Arquivo<\/small>\s*<strong>([^<]+)<\/strong>/;

const UNITS = { KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 };

function infohashFrom(magnet) {
  const xt = magnet.match(/btih:([a-zA-Z0-9]+)/);
  if (!xt) return null;

  return normalizeInfohash(xt[1]);
}

function sizeToBytes(text) {
  const match = String(text ?? '').match(/([\d.,]+)\s*(KB|MB|GB|TB)/i);
  if (!match) return null;

  const value = Number(match[1].replace(',', '.'));
  return Number.isFinite(value) ? Math.round(value * UNITS[match[2].toUpperCase()]) : null;
}

/** Uma pagina de listagem: 20 cartoes, cada um com link e tipo declarados. */
function parseList(html) {
  const cards = [];

  for (const match of String(html).matchAll(CARD)) {
    cards.push({
      url: match[1],
      title: ATTR(match[0], 'title'),
      kind: ATTR(match[0], 'tipo'),
    });
  }

  return cards;
}

/**
 * A pagina do titulo. O `dn=` do magnet carrega as marcas de release, mas com
 * as tags antes do nome -- o classificador cortaria o titulo no primeiro
 * marcador. Por isso o nome limpo da listagem vem na frente: ele vira o
 * titulo, e o `dn` continua servindo de fonte para ano, resolucao e codec.
 */
function parseDetail(html, title) {
  const found = String(html).match(MAGNET);
  if (!found) return null;

  const magnet = found[0].replace(/&amp;/g, '&');
  const infohash = infohashFrom(magnet);
  if (!infohash) return null;

  const dn = magnet.match(/[?&]dn=([^&]*)/);
  const release = dn ? decodeURIComponent(dn[1]).replace(/\+/g, ' ') : null;
  if (!release) return null;

  return {
    infohash,
    name: title ? `${title}. ${release}` : release,
    sizeBytes: sizeToBytes((String(html).match(SIZE) || [])[1]),
  };
}

module.exports = { parseList, parseDetail, base32ToHex, sizeToBytes };
