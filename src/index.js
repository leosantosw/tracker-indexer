'use strict';

const baseConfig = require('./config');
const { openDb } = require('./db');
const { createRepo } = require('./db/repo');
const { createSettingsStore } = require('./settings');
const { generateKey } = require('./lib/secrets');
const { runSync, runEnrich } = require('./job/pipeline');
const { buildServer } = require('./api/server');

const log = (msg) => console.log(`${new Date().toISOString()} ${msg}`);

const USAGE = `
  npm run sync                    sincroniza os trackers e enriquece pela TMDB
  npm run enrich                  so o enriquecimento, sem tocar nos trackers
  npm run stats                   quantos itens por tracker
  npm run serve                   sobe a API e a interface em /admin
  npm run query "SELECT ..."      consulta o banco (somente leitura)
  npm run keygen                  gera uma SECRETS_KEY para o .env
`;

/** Commands that never touch the database. */
const standalone = {
  keygen() {
    console.log(`SECRETS_KEY=${generateKey()}`);
  },
};

const commands = {
  async sync(repo) {
    await runSync({ repo, config: createSettingsStore(repo).config(), log });
  },

  async enrich(repo) {
    await runEnrich({ repo, config: createSettingsStore(repo).config(), log });
  },

  async stats(repo) {
    const rows = repo.stats();
    if (!rows.length) return log('nada indexado ainda. rode: npm run sync');
    for (const row of rows) log(`${row.source}: ${row.total} itens`);

    for (const row of repo.workStats()) log(`tmdb ${row.status}: ${row.total} obras`);
  },

  async query(repo, sql) {
    if (!sql) throw new Error('informe a query: npm run query "SELECT * FROM item LIMIT 5"');
    console.log(JSON.stringify(repo.query(sql), null, 2));
  },

  async serve(repo) {
    const app = await buildServer(repo);
    await app.listen(baseConfig.api);
    log(`API em http://localhost:${baseConfig.api.port} (docs em /api/docs, painel em /admin)`);
    return 'keep-alive';
  },
};

async function main() {
  const [command, arg] = process.argv.slice(2);
  if (Object.hasOwn(standalone, command ?? '')) return standalone[command]();

  if (!Object.hasOwn(commands, command ?? '')) {
    console.log(USAGE);
    return;
  }

  const db = openDb(baseConfig.dbFile);
  try {
    const result = await commands[command](createRepo(db), arg);
    if (result !== 'keep-alive') db.close();
  } catch (err) {
    db.close();
    throw err;
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
