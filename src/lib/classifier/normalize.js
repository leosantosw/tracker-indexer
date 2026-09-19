'use strict';

const MARKS = {
  acute: '́', grave: '̀', circ: '̂',
  tilde: '̃', uml: '̈', cedil: '̧',
};

const ACCENT_RE = /&([a-z])(acute|grave|circ|tilde|uml|cedil);/gi;
const ENTITY_RE = /&[a-z]+;|&#\d+;/gi;

/** "P&acirc;nico" -> letra + circunflexo -> "Pânico". */
const decodeEntities = (raw) =>
  String(raw ?? '')
    .replace(ACCENT_RE, (match, letter, mark) =>
      (letter + MARKS[mark.toLowerCase()]).normalize('NFC')
    )
    .replace(ENTITY_RE, ' ');

const stripAccents = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Texto usado pelas regras: minusculo, sem acento, so letras/numeros/espaco.
 * Marcas com simbolo viram palavra antes da limpeza, senao se perderiam:
 * "HDR10+" -> hdr10plus, "DD+" -> ddp, "H.264" -> h 264.
 */
function matchable(raw) {
  return stripAccents(decodeEntities(raw))
    .toLowerCase()
    .replace(/hdr\s*10\s*\+/g, ' hdr10plus ')
    .replace(/\bdd\s*\+/g, ' ddp ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b\d{3,4}x(2160|1080|720|480)\b/g, '$1p')
    .replace(/\b(ddp|eac3|ac3|aac|dts|truehd|flac|opus)(\d)/g, '$1 $2')
    .trim();
}

/** Texto legivel: preserva acento e caixa, so troca separadores por espaco. */
const readable = (raw) =>
  decodeEntities(raw)
    .replace(/[._]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Procura todos os apelidos do dicionario, do mais longo para o mais curto. */
function findAll(text, dictionary) {
  const found = [];

  for (const alias of Object.keys(dictionary).sort((a, b) => b.length - a.length)) {
    if (!new RegExp(`\\b${alias}\\b`).test(text)) continue;

    const value = dictionary[alias];
    // "DTS-HD" ja cobre "DTS"; "HDR10+" ja cobre "HDR10".
    if (found.some((existing) => existing.includes(value))) continue;
    found.push(value);
  }

  return found;
}

const findOne = (text, dictionary) => findAll(text, dictionary)[0] ?? null;

module.exports = { decodeEntities, stripAccents, matchable, readable, findAll, findOne };
