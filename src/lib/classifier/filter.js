'use strict';

/**
 * Em vez de listar tudo que nao queremos (exe, zip, rar, jogo, software...),
 * basta exigir marca de filme: resolucao, fonte ou codec de video. O que nao
 * tem nenhuma delas nao e filme nem serie.
 *
 * As capturas de cinema sao a excecao que precisa de bloqueio explicito: elas
 * tem as marcas ("1080p TC"), mas a qualidade nao presta.
 */
const { BAD_SOURCES } = require('./tags');

module.exports = {
  name: 'filter',

  classify(text, raw, { resolution, source, videoCodec, container, audio, season }) {
    if (BAD_SOURCES.has(source)) return { rejected: true, reason: `fonte ${source}` };

    const hasFormat =
      resolution || source || videoCodec || container || audio.length > 0 || season !== null;

    return hasFormat ? { rejected: false } : { rejected: true, reason: 'sem formato de filme' };
  },
};
