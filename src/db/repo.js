'use strict';

const { createItems } = require('./items');
const { createWorks } = require('./works');
const { createSettings } = require('./settings');
const { createSearch } = require('./search');
const { createUnmatched } = require('./unmatched');

/**
 * Uma fachada sobre as duas entidades: `item` e a copia que veio do tracker,
 * `work` e a obra em si. Cada tabela mora no seu modulo.
 */
const createRepo = (db) => ({
  ...createItems(db),
  ...createWorks(db),
  ...createSettings(db),
  ...createSearch(db),
  ...createUnmatched(db),
});

module.exports = { createRepo };
