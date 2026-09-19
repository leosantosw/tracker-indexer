'use strict';

const { createItems } = require('./items');
const { createWorks } = require('./works');
const { createSettings } = require('./settings');

/**
 * Uma fachada sobre as duas entidades: `item` e a copia que veio do tracker,
 * `work` e a obra em si. Cada tabela mora no seu modulo.
 */
const createRepo = (db) => ({ ...createItems(db), ...createWorks(db), ...createSettings(db) });

module.exports = { createRepo };
