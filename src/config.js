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

  api: {
    port: num('API_PORT', 3000),
    host: process.env.API_HOST || '0.0.0.0',
  },

  // Encrypts the secrets saved from the panel. Without it they stay env-only.
  secretsKey: process.env.SECRETS_KEY || null,

  // Optional: without it, the first visit to /admin creates one.
  admin: {
    token: process.env.ADMIN_TOKEN || null,
  },

  // Token the apps (the TV) send to every /api route but /health. Without it, they answer no one.
  apps: {
    token: process.env.API_TOKEN || null,
  },

  // Automatic catalog update. Set from the panel; off until turned on there.
  schedule: {
    enabled: false,
    mode: 'daily', // 'daily' at `time` on `days` (0 = domingo) | 'interval' every `everyMinutes`
    time: '03:00',
    days: [0, 1, 2, 3, 4, 5, 6],
    everyMinutes: 60,
  },

  // `provider` picks one of src/debrid; each provider reads its own token.
  debrid: {
    provider: process.env.DEBRID_PROVIDER || null,
    tokens: {
      torbox: process.env.TORBOX_API_KEY || null,
    },
  },

  // Sem apiKey o enriquecimento e pulado e o resto do job segue igual.
  tmdb: {
    apiKey: process.env.TMDB_API_KEY || null,
    language: process.env.TMDB_LANGUAGE || 'pt-BR',
    rps: num('TMDB_RPS', 8),
    // De quanto em quanto tempo revalidar uma obra ja casada: nota muda.
    staleDays: num('TMDB_STALE_DAYS', 30),
    // De quanto em quanto tempo tentar de novo o que nao casou: filme recente
    // pode ainda nao estar na TMDB. 0 desliga.
    retryDays: num('TMDB_RETRY_DAYS', 14),
    // Abaixo disso a nota nao e divulgada nem usada para ordenar: 8.0 apurado
    // em 4 votos nao e nota, e ruido.
    minVotes: num('TMDB_MIN_VOTES', 150),
  },
};
