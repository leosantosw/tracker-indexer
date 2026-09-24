'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const { openDb } = require('../src/db');
const { createRepo } = require('../src/db/repo');
const { buildAuthedServer } = require('./authed');

const release = (over = {}) => ({
  canonical: 'Filme (2024) 1080p WEB-DL',
  title: 'Filme',
  year: 2024,
  type: 'movie',
  season: null,
  episode: null,
  resolution: '1080p',
  source: 'WEB-DL',
  videoCodec: null,
  audio: [],
  hdr: [],
  ...over,
});

const item = (sourceId, over = {}, releaseOver = {}) => ({
  sourceId,
  infohash: sourceId.padEnd(40, '0'),
  name: 'Filme (2024) 1080p WEB-DL',
  sizeBytes: 2569437745,
  createdUnix: 1700000000,
  seeders: 10,
  leechers: 1,
  ...over,
  release: release(releaseOver),
});

/**
 * Um filme com duas copias e uma serie com dois episodios -- o suficiente para
 * ver a obra separada das copias.
 */
async function setup() {
  const db = openDb(':memory:');
  const repo = createRepo(db);

  repo.savePage('fake', [
    item('filme-1080', { seeders: 3 }),
    item('filme-720', { seeders: 50, sizeBytes: 13138266112 }),
    item('serie-e1', { seeders: 7 }, { title: 'Serie', type: 'series', season: 1, episode: 1 }),
    item('serie-e2', { seeders: 9 }, { title: 'Serie', type: 'series', season: 1, episode: 2 }),
  ]);

  // O enrich e quem cria a linha em `work`; aqui so o resultado dele importa.
  repo.saveWork(
    { type: 'movie', title: 'Filme', year: 2024 },
    {
      status: 'ok',
      match: {
        tmdbId: 42,
        title: 'Filme',
        overview: 'sinopse',
        rating: 8.1,
        votes: 900,
        posterPath: '/p.jpg',
        backdropPath: null, // a TMDB nem sempre tem a horizontal
        trailerKey: 'abc123',
      },
    }
  );
  repo.saveWork({ type: 'series', title: 'Serie', year: null }, { status: 'ambiguous' });

  const app = await buildAuthedServer(repo);
  await app.ready();

  const get = async (url) => {
    const res = await app.inject({ url });
    return { code: res.statusCode, body: JSON.parse(res.payload) };
  };
  return { get, db };
}

test('/api/movies lista obra, nao torrent', async () => {
  const { get, db } = await setup();

  const { movies } = (await get('/api/movies')).body;

  assert.equal(movies.length, 1, 'duas copias do mesmo filme sao uma obra so');
  assert.equal(movies[0].title, 'Filme');
  db.close();
});

test('a listagem traz so o cartao da grade', async () => {
  const { get, db } = await setup();

  const [movie] = (await get('/api/movies')).body.movies;

  assert.deepEqual(Object.keys(movie).sort(), ['backdrop', 'id', 'poster', 'rating', 'title', 'year']);
  assert.equal(movie.poster, 'https://image.tmdb.org/t/p/w185/p.jpg', 'capa pequena na grade');
  assert.equal(movie.backdrop, null, 'sem backdrop e nulo, nao URL quebrada');
  assert.equal(movie.rating, 8.1);
  db.close();
});

test('o detalhe traz tudo, com as copias dentro', async () => {
  const { get, db } = await setup();

  const [linha] = (await get('/api/movies')).body.movies;
  const detalhe = (await get(`/api/movies/${linha.id}`)).body;

  assert.equal(detalhe.overview, 'sinopse');
  assert.equal(detalhe.votes, 900);
  assert.equal(detalhe.poster, 'https://image.tmdb.org/t/p/w342/p.jpg', 'capa maior no detalhe');
  assert.equal(detalhe.trailer, 'https://www.youtube.com/watch?v=abc123');

  assert.deepEqual(detalhe.torrents.map((t) => t.seeders), [50, 3], 'da mais semeada para a menos');
  assert.equal(detalhe.torrents[0].size, '12.24 GB');
  assert.equal(detalhe.torrents[0].resolution, '1080p');
  db.close();
});

test('a obra nao traz o que so serve ao SQL', async () => {
  const { get, db } = await setup();

  const [linha] = (await get('/api/movies')).body.movies;
  const detalhe = (await get(`/api/movies/${linha.id}`)).body;

  for (const campo of ['tmdbId', 'status', 'releaseDate', 'lastAdded', 'bestSeeders', 'seeders', 'infohash']) {
    assert.equal(campo in detalhe, false, `${campo} nao devia estar na obra`);
  }
  db.close();
});

test('por padrao so lista o que casou com a TMDB', async () => {
  const { get, db } = await setup();

  // A serie do cenario ficou `ambiguous`; o filme casou.
  assert.equal((await get('/api/series')).body.series.length, 0);
  assert.equal((await get('/api/movies')).body.movies.length, 1);
  db.close();
});

test('a obra sem match continua acessivel por id, com as copias', async () => {
  const { get, db } = await setup();

  // Some da listagem, nao do acervo: torrent que existe continua alcancavel.
  const { id } = db.prepare("SELECT id FROM work WHERE type = 'series'").get();
  const serie = await get(`/api/series/${id}`);

  assert.equal(serie.code, 200);
  assert.equal(serie.body.torrents.length, 2);
  db.close();
});

test('a copia nao repete os dados da obra', async () => {
  const { get, db } = await setup();

  const [movie] = (await get('/api/movies')).body.movies;
  const [torrent] = (await get(`/api/movies/${movie.id}`)).body.torrents;

  for (const campo of ['poster', 'overview', 'rating', 'votes', 'title', 'year']) {
    assert.equal(campo in torrent, false, `${campo} nao devia estar na copia`);
  }
  db.close();
});

test('season e episode so aparecem em copia de serie', async () => {
  const { get, db } = await setup();

  const serie = db.prepare("SELECT id FROM work WHERE type = 'series'").get();
  const { torrents } = (await get(`/api/series/${serie.id}`)).body;
  const [movie] = (await get('/api/movies')).body.movies;
  const [copia] = (await get(`/api/movies/${movie.id}`)).body.torrents;

  assert.deepEqual(torrents.map((t) => t.episode).sort(), [1, 2]);
  assert.equal('season' in copia, false);
  db.close();
});

test('id do tipo errado da 404; a rota /torrents nao existe mais', async () => {
  const { get, db } = await setup();

  const [movie] = (await get('/api/movies')).body.movies;

  assert.equal((await get(`/api/movies/${movie.id}`)).code, 200);
  assert.equal((await get(`/api/series/${movie.id}`)).code, 404);
  assert.equal((await get('/api/movies/999999')).code, 404);
  assert.equal((await get(`/api/movies/${movie.id}/torrents`)).code, 404);
  db.close();
});

test('resposta sai comprimida e com ETag; repetir da 304', async () => {
  const { db } = await setup();
  const repo = createRepo(db);
  const app = await buildAuthedServer(repo);

  // Abaixo de 1 KB nao compensa comprimir; o spec do Swagger passa disso.
  const big = await app.inject({ url: '/api/docs/json', headers: { 'accept-encoding': 'gzip' } });
  assert.equal(big.headers['content-encoding'], 'gzip');

  const first = await app.inject({ url: '/api/movies' });
  assert.equal(first.headers['cache-control'], 'no-cache');
  assert.ok(first.headers.etag);

  const again = await app.inject({ url: '/api/movies', headers: { 'if-none-match': first.headers.etag } });
  assert.equal(again.statusCode, 304);
  assert.equal(again.payload, '');
  await app.close();
  db.close();
});

/** Cria a obra e o torrent dela em um passo, so com o que a ordenacao olha. */
let proximoTmdbId = 1;

const comNota = (repo, nome, ano, rating, votes) => {
  repo.savePage('fake', [item(nome, {}, { title: nome, year: ano })]);
  repo.saveWork(
    { type: 'movie', title: nome, year: ano },
    { status: 'ok', match: { tmdbId: proximoTmdbId++, title: nome, rating, votes } }
  );
};

const lista = async (repo, url = '/api/movies') => {
  const app = await buildAuthedServer(repo);
  await app.ready();
  return JSON.parse((await app.inject({ url })).payload).movies;
};

test('por padrao ordena por ano, do mais novo para o mais antigo', async () => {
  const db = openDb(':memory:');
  const repo = createRepo(db);

  for (const ano of [1994, 2026, 2010]) comNota(repo, `Filme ${ano}`, ano, 7, 500);

  const movies = await lista(repo);

  assert.deepEqual(movies.map((m) => m.year), [2026, 2010, 1994]);
  db.close();
});

test('dentro do mesmo ano, quem manda e a nota', async () => {
  const db = openDb(':memory:');
  const repo = createRepo(db);

  comNota(repo, 'Media', 2026, 6.5, 500);
  comNota(repo, 'Melhor', 2026, 9.1, 500);
  comNota(repo, 'Pior', 2026, 4.2, 500);

  const movies = await lista(repo);

  assert.deepEqual(movies.map((m) => m.title), ['Melhor', 'Media', 'Pior']);
  db.close();
});

test('quem tem nota vem antes de quem nao tem, em qualquer ano', async () => {
  const db = openDb(':memory:');
  const repo = createRepo(db);

  comNota(repo, 'Ruido', 2026, 10, 4); // abaixo de 150 votos: sem nota apurada
  comNota(repo, 'Apurada', 2026, 7.2, 500);
  comNota(repo, 'Ano anterior', 2025, 5.1, 500);

  const movies = await lista(repo);

  // Nota qualquer ganha de nota nenhuma: 5.1 de 2025 passa na frente do
  // lancamento de 2026 sem votacao -- e o 10 de 4 votos vai para o fim.
  assert.deepEqual(movies.map((m) => m.title), ['Apurada', 'Ano anterior', 'Ruido']);
  assert.equal(movies[2].rating, null);
  db.close();
});

test('query fora do schema da 400', async () => {
  const { get, db } = await setup();

  assert.equal((await get('/api/movies?limit=999')).code, 400);
  assert.equal((await get('/api/movies?page=0')).code, 400);
  assert.equal((await get('/api/movies/abc')).code, 400);
  db.close();
});

test('parametro que nao existe e ignorado, nao burla a rota', async () => {
  const { get, db } = await setup();

  // A listagem so aceita page e limit; o resto o Fastify descarta.
  const { movies } = (await get('/api/movies?type=series&minRating=9')).body;

  assert.equal(movies.length, 1);
  assert.equal(movies[0].title, 'Filme');
  db.close();
});

test('a pagina se descreve: page, limit, total e pages', async () => {
  const db = openDb(':memory:');
  const repo = createRepo(db);

  for (let n = 0; n < 7; n++) comNota(repo, `Filme ${n}`, 2020 + n, 7, 500);

  const app = await buildAuthedServer(repo);
  await app.ready();
  const pagina = async (url) => JSON.parse((await app.inject({ url })).payload);

  const primeira = await pagina('/api/movies?limit=3');
  assert.deepEqual(
    { page: primeira.page, limit: primeira.limit, total: primeira.total, pages: primeira.pages },
    { page: 1, limit: 3, total: 7, pages: 3 }
  );
  assert.equal(primeira.movies.length, 3);

  const ultima = await pagina('/api/movies?page=3&limit=3');
  assert.equal(ultima.movies.length, 1, 'a ultima pagina traz o resto');

  const vazia = await pagina('/api/movies?page=99&limit=3');
  assert.deepEqual(vazia.movies, []);
  assert.equal(vazia.total, 7, 'o total nao muda por pedir pagina inexistente');
  db.close();
});

test('paginar nao repete nem pula obra', async () => {
  const db = openDb(':memory:');
  const repo = createRepo(db);

  // Mesmo ano e mesma nota: so o desempate estavel evita sobreposicao.
  for (let n = 0; n < 10; n++) comNota(repo, `Filme ${n}`, 2020, 7, 500);

  const app = await buildAuthedServer(repo);
  await app.ready();
  const ids = [];
  for (const page of [1, 2, 3, 4]) {
    const { movies } = JSON.parse((await app.inject({ url: `/api/movies?page=${page}&limit=3` })).payload);
    ids.push(...movies.map((m) => m.id));
  }

  assert.equal(ids.length, 10);
  assert.equal(new Set(ids).size, 10);
  db.close();
});

test('obra que perdeu todas as copias some da listagem', async () => {
  const { get, db } = await setup();

  db.prepare("DELETE FROM item WHERE type = 'movie'").run();

  assert.equal((await get('/api/movies')).body.movies.length, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS c FROM work WHERE type='movie'").get().c, 1);
  db.close();
});

test('o spec do swagger documenta as quatro rotas do catalogo', async () => {
  const db = openDb(':memory:');
  const app = await buildAuthedServer(createRepo(db));
  await app.ready();

  const spec = app.swagger();

  for (const path of [
    '/api/movies',
    '/api/movies/{id}',
    '/api/series',
    '/api/series/{id}',
  ]) {
    assert.ok(spec.paths[path], `faltou ${path} no spec`);
  }
  assert.equal(spec.paths['/api/movies/{id}/torrents'], undefined);

  const schemas = spec.components.schemas;
  assert.ok(schemas.Movie && schemas.MovieTorrent && schemas.MovieListItem);
  assert.equal('seeders' in schemas.Movie.properties, false);
  assert.equal('overview' in schemas.MovieListItem.properties, false, 'sinopse so no detalhe');
  assert.equal('rating' in schemas.MovieTorrent.properties, false);

  // Colunas que so servem para ordenar e filtrar nao podem vazar no spec.
  for (const oculto of ['tmdbId', 'status', 'releaseDate', 'lastAdded']) {
    assert.equal(oculto in schemas.Movie.properties, false, `${oculto} vazou no spec`);
  }
  db.close();
});
