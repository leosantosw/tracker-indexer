'use strict';

const config = require('./config');
const { openDb } = require('./db');
const { createRepo } = require('./db/repo');
const { createSources, createTmdbClient } = require('./sources');
const { syncSource } = require('./job/sync');
const { enrich } = require('./job/enrich');
const { buildServer } = require('./api/server');

const log = (msg) => console.log(`${new Date().toISOString()} ${msg}`);

const USAGE = `
  npm run sync                    sincroniza os trackers e enriquece pela TMDB
  npm run enrich                  so o enriquecimento, sem tocar nos trackers
  npm run stats                   quantos itens por tracker
  npm run serve                   sobe a API
  npm run query "SELECT ..."      consulta o banco (somente leitura)
`;

/**
 * Segundo passo, compartilhado por `sync` e `enrich`. Roda depois das regras
 * do tracker: elas apagam quase um quarto do catalogo, e consultar antes seria
 * gastar chamada em item que vai embora em seguida.
 */
async function runEnrich(repo) {
  const tmdb = createTmdbClient(config);
  if (!tmdb) return log('tmdb: sem TMDB_API_KEY, enriquecimento pulado');

  const total = await enrich({ repo, tmdb, config, log });
  if (!total.seen && !total.failed) return log('tmdb: nada novo para consultar');

  log(
    `tmdb: ${total.ok} casadas, ${total.ambiguous} ambiguas, ` +
      `${total.notFound} sem match, ${total.skipped} ignoradas` +
      (total.failed ? `, ${total.failed} com erro` : '')
  );
}

const commands = {
  async sync(repo) {
    for (const source of createSources(config)) {
      const total = await syncSource(source, { repo, config, log });
      // Cada parcela leva o proprio sinal: "-196 sem ano, 95 duplicados" faria
      // o segundo numero parecer coisa que entrou.
      const { noYear, duplicate } = total.removed;
      const cut = [noYear && `-${noYear} sem ano`, duplicate && `-${duplicate} duplicados`]
        .filter(Boolean)
        .join(', ');

      log(`${source.name}: ${total.pages} paginas, ${total.inserted} novos${cut ? `, ${cut}` : ''}`);
    }

    // A TMDB fora do ar nao pode derrubar o sync: o dado do tracker ja esta
    // gravado, e torrent que some nao volta -- capa, sim, na proxima run.
    try {
      await runEnrich(repo);
    } catch (err) {
      log(`tmdb: ${err.message}`);
    }
  },

  async enrich(repo) {
    await runEnrich(repo);
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
    await app.listen(config.api);
    log(`API em http://localhost:${config.api.port} (docs em /docs)`);
    return 'keep-alive';
  },
};

async function main() {
  const [command, arg] = process.argv.slice(2);

  if (!Object.hasOwn(commands, command ?? '')) {
    console.log(USAGE);
    return;
  }

  const db = openDb(config.dbFile);
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
