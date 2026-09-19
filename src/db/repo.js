'use strict';

const { createItems } = require('./items');
const { createWorks } = require('./works');

/**
 * Uma fachada sobre as duas entidades: `item` e a copia que veio do tracker,
 * `work` e a obra em si. Cada tabela mora no seu modulo.
 */
const createRepo = (db) => ({ ...createItems(db), ...createWorks(db) });

module.exports = { createRepo };
