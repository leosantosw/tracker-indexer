'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const baseConfig = require('../src/config');
const { openDb } = require('../src/db');
const { createRepo } = require('../src/db/repo');
const { createSources } = require('../src/sources');
const { createSettingsStore } = require('../src/settings');
const { generateKey } = require('../src/lib/secrets');

const KEY = generateKey();
const env = (over = {}) => ({ ...baseConfig, secretsKey: KEY, ...over });

function setup(base = env()) {
  const repo = createRepo(openDb(':memory:'));
  return { repo, store: createSettingsStore(repo, { base }) };
}

const sourceOf = (config, name) => config.sources.find((source) => source.name === name);
const rawSecrets = (repo) => repo.readSettings().secrets ?? {};

test('sem nada salvo, vale o que o codigo declara', () => {
  const { store } = setup();
  const config = store.config();

  assert.deepEqual(
    config.sources.map((source) => [source.name, source.mode, source.enabled]),
    [
      ['torrents-csv', 'terms', true],
      ['redes-torrents', 'pages', true],
      ['comando', 'pages', true],
      ['torrent-dos-filmes', 'pages', true],
      ['amigos-share-club', 'pages', false],
    ]
  );
  assert.equal(sourceOf(config, 'redes-torrents').pages, 10);
  assert.deepEqual(sourceOf(config, 'torrents-csv').rules, { requireYear: true, dedupe: 'seeders' });
});

test('tracker desativado nao e construido', () => {
  const { store } = setup();
  store.save({ sources: { 'redes-torrents': { enabled: false } } });

  const names = createSources(store.config()).map((source) => source.name);
  assert.deepEqual(names, ['torrents-csv', 'comando', 'torrent-dos-filmes']);
});

test('patch parcial preserva o que ja estava salvo', () => {
  const { store } = setup();
  store.save({ sources: { 'torrents-csv': { rps: 1, rules: { dedupe: null } } } });
  store.save({ sources: { 'torrents-csv': { terms: ['dublado'] } }, tmdb: { minVotes: 10 } });

  const config = store.config();
  const source = sourceOf(config, 'torrents-csv');
  assert.equal(source.rps, 1);
  assert.deepEqual(source.terms, ['dublado']);
  assert.deepEqual(source.rules, { requireYear: true, dedupe: null });
  assert.equal(config.tmdb.minVotes, 10);
});

test('tracker por pagina ignora termos, para nao mudar de modo', () => {
  const { store } = setup();
  store.save({ sources: { 'redes-torrents': { terms: ['dublado'] } } });

  assert.equal(sourceOf(store.config(), 'redes-torrents').terms, null);
});

test('tracker desconhecido e recusado sem gravar nada', () => {
  const { repo, store } = setup();

  assert.throws(
    () => store.save({ tmdb: { minVotes: 1 }, sources: { nope: { enabled: false } } }),
    (err) => err.statusCode === 400 && /nope/.test(err.message)
  );
  assert.deepEqual(repo.readSettings(), {});
});

test('segredo e gravado cifrado e aplicado na config', () => {
  const { repo, store } = setup(env({ tmdb: { ...baseConfig.tmdb, apiKey: 'do-env' } }));
  store.save({ secrets: { tmdbApiKey: 'chave-do-painel-123' } });

  assert.equal(store.config().tmdb.apiKey, 'chave-do-painel-123');
  assert.ok(!JSON.stringify(repo.readSettings()).includes('chave-do-painel-123'));
  assert.match(rawSecrets(repo).tmdbApiKey, /^v1\./);
});

test('a view diz de onde vem o segredo, nunca o valor', () => {
  const { store } = setup(env({ admin: { token: 'token-do-env-000000' } }));
  store.save({ secrets: { tmdbApiKey: 'chave-do-painel-123' } });

  const view = store.view();
  assert.deepEqual(view.secrets, {
    encryption: true,
    tmdbApiKey: { source: 'panel', error: null },
    adminToken: { source: 'env', error: null },
    apiToken: { source: null, error: null },
    torboxToken: { source: null, error: null },
    'amigos-share-club:username': { source: null, error: null },
    'amigos-share-club:password': { source: null, error: null },
  });
  assert.ok(!JSON.stringify(view).includes('chave-do-painel-123'));
  assert.ok(!JSON.stringify(view).includes('token-do-env-000000'));
});

test('remover o segredo do painel devolve o valor do .env', () => {
  const { store } = setup(env({ admin: { token: 'token-do-env-000000' } }));
  store.save({ secrets: { adminToken: 'token-do-painel-0000' } });
  assert.equal(store.config().admin.token, 'token-do-painel-0000');

  store.save({ secrets: { adminToken: null } });
  assert.equal(store.config().admin.token, 'token-do-env-000000');
});

test('sem SECRETS_KEY, salvar segredo e recusado', () => {
  const { repo, store } = setup(env({ secretsKey: null }));

  assert.throws(() => store.save({ secrets: { tmdbApiKey: 'chave-do-painel-123' } }), /SECRETS_KEY/);
  assert.deepEqual(rawSecrets(repo), {});
  assert.equal(store.view().secrets.encryption, false);
});

test('chave trocada nao derruba nada: o segredo e ignorado e vale o .env', () => {
  const { repo, store } = setup(env({ tmdb: { ...baseConfig.tmdb, apiKey: 'do-env' } }));
  store.save({ secrets: { tmdbApiKey: 'chave-do-painel-123' } });

  const other = createSettingsStore(repo, { base: env({ secretsKey: generateKey(), tmdb: { ...baseConfig.tmdb, apiKey: 'do-env' } }) });
  assert.equal(other.config().tmdb.apiKey, 'do-env');
  assert.match(other.view().secrets.tmdbApiKey.error, /SECRETS_KEY/);
});

test('cifra copiada para outro campo nao abre', () => {
  const { repo, store } = setup();
  store.save({ secrets: { tmdbApiKey: 'chave-do-painel-123' } });

  const { tmdbApiKey } = rawSecrets(repo);
  repo.writeSettings({ secrets: { adminToken: tmdbApiKey } });

  const fresh = createSettingsStore(repo, { base: env() });
  assert.equal(fresh.config().admin.token, baseConfig.admin.token);
  assert.ok(fresh.view().secrets.adminToken.error);
});

test('reset volta aos padroes mas mantem os segredos', () => {
  const { store } = setup();
  store.save({ tmdb: { staleDays: 3 }, secrets: { tmdbApiKey: 'chave-do-painel-123' } });
  store.reset();

  assert.equal(store.config().tmdb.staleDays, baseConfig.tmdb.staleDays);
  assert.equal(store.config().tmdb.apiKey, 'chave-do-painel-123');
});

test('tracker privado nasce fora das atualizações, até alguém adicionar', () => {
  const { store } = setup();

  const source = sourceOf(store.config(), 'amigos-share-club');

  assert.equal(source.enabled, false);
  assert.equal(source.requiresLogin, true);
  assert.equal(source.access, 'private');
});

test('usuário e senha do tracker são gravados cifrados e só chegam ao tracker', () => {
  const { repo, store } = setup();

  store.save({ secrets: { 'amigos-share-club:username': 'leo', 'amigos-share-club:password': 's3nha secreta' } });

  assert.deepEqual(sourceOf(store.config(), 'amigos-share-club').credentials, { username: 'leo', password: 's3nha secreta' });
  assert.ok(!JSON.stringify(rawSecrets(repo)).includes('s3nha'), 'no banco só vai o texto cifrado');

  const view = store.view();
  assert.equal(view.secrets['amigos-share-club:password'].source, 'panel');
  assert.ok(view.sources.every((source) => !('credentials' in source)), 'a lista de trackers do painel nunca leva as credenciais');
  assert.ok(!JSON.stringify(view).includes('s3nha'));
});

test('apenas freeleech só vale para o tracker que suporta', () => {
  const { store } = setup();

  store.save({ sources: { 'amigos-share-club': { freeleechOnly: true }, comando: { freeleechOnly: true } } });

  assert.equal(sourceOf(store.config(), 'amigos-share-club').freeleechOnly, true);
  assert.equal('freeleechOnly' in sourceOf(store.config(), 'comando'), false);
});
