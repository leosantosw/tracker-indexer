'use strict';

/** Lowercase, no accents, punctuation as spaces: "Homem-Aranha: Através" -> "homem aranha atraves". */
const fold = (text) =>
  text == null
    ? null
    : String(text)
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

module.exports = { fold };
