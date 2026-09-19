'use strict';

/** Env invalida vira erro no boot; um NaN adiante faz o retry rodar para sempre. */
function num(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`${name} invalida: "${raw}" nao e um numero`);
  return parsed;
}

module.exports = {
  dbFile: process.env.DB_FILE || './data/catalog.db',

  http: {
    timeoutMs: num('HTTP_TIMEOUT_MS', 20000),
    retries: num('HTTP_RETRIES', 3),
  },

  sync: {
    maxPagesPerTerm: num('SYNC_MAX_PAGES_PER_TERM', 100),
    maxPagesPerRun: num('SYNC_MAX_PAGES_PER_RUN', 400),
  },

  api: {
    port: num('API_PORT', 3000),
    host: process.env.API_HOST || '0.0.0.0',
  },

  // Sem apiKey o enriquecimento e pulado e o resto do job segue igual.
  tmdb: {
    apiKey: process.env.TMDB_API_KEY || null,
    language: process.env.TMDB_LANGUAGE || 'pt-BR',
    rps: num('TMDB_RPS', 8),
    // De quanto em quanto tempo revalidar uma obra ja casada: nota muda.
    staleDays: num('TMDB_STALE_DAYS', 30),
    // Abaixo disso a nota nao e divulgada nem usada para ordenar: 8.0 apurado
    // em 4 votos nao e nota, e ruido.
    minVotes: num('TMDB_MIN_VOTES', 150),
  },
};
