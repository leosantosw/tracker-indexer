'use strict';

const { matchable } = require('./normalize');

/**
 * Para adicionar um classificador: crie o arquivo e acrescente uma linha aqui.
 * Contrato: { name, classify(text, raw, result) -> campos a mesclar no resultado }
 *
 * `text` vem normalizado (minusculo, sem acento, sem pontuacao) e `raw` e o
 * titulo original, para quem precisa preservar caixa e acento.
 *
 * A ordem importa: quem marca `rejected` interrompe a cadeia.
 */
const CLASSIFIERS = [require('./release'), require('./filter')];

function classify(rawTitle, classifiers = CLASSIFIERS) {
  const text = matchable(rawTitle);
  const result = { rejected: false, reason: null };

  for (const classifier of classifiers) {
    Object.assign(result, classifier.classify(text, rawTitle, result));
    if (result.rejected) return result;
  }

  return result;
}

module.exports = { classify, CLASSIFIERS };
