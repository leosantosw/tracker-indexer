'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const { openDb } = require('../src/db');
const { createRepo } = require('../src/db/repo');
const { buildServer } = require('../src/api/server');
const { enrich } = require('../src/job/enrich');
const { createTmdb, pickMatch, pickTrailer } = require('../src/sources/tmdb');

const config = { tmdb: { staleDays: 30 } };
const log = () => {};

const candidate = (over = {}) => ({
  tmdbId: 1,
  title: 'Filme',
  originalTitle: null,
  year: 2020,
  overview: 'sinopse',
  rating: 7,
  votes: 500, // acima de TMDB_MIN_VOTES: a nota conta
  posterPath: '/a.jpg',
  backdropPath: '/b.jpg',
  genres: [],
  popularity: 1,
  ...over,
});

/** getJson falso: responde o dicionario de generos e a busca. */
const fakeJson = (results = []) => {
  const calls = [];
  const getJson = async (url) => {
    calls.push(url);
    if (url.pathname.includes('/genre/')) {
      return { genres: [{ id: 27, name: 'Terror' }, { id: 53, name: 'Thriller' }] };
    }
    if (url.pathname.includes('/search/')) return { results };
    // Detalhe da obra: e daqui que sai o trailer.
    return {
      videos: {
        results: [
          { site: 'YouTube', type: 'Clip', key: 'clipe', iso_639_1: 'pt', official: true },
          { site: 'YouTube', type: 'Trailer', key: 'trailerPt', iso_639_1: 'pt', official: true },
          { site: 'YouTube', type: 'Trailer', key: 'trailerEn', iso_639_1: 'en', official: true },
        ],
      },
    };
  };
  return { getJson, calls };
};

// --- a regra de match, sem rede ---

test('sem resultado nenhum e not_found', () => {
  assert.equal(pickMatch([], { title: 'A', year: 2020 }).status, 'not_found');
});

test('com ano, aceita ate um ano de diferenca', () => {
  const work = { title: 'Ainda Estou Aqui', year: 2024 };
  const found = (y) => pickMatch([candidate({ title: work.title, year: y })], work);

  assert.equal(found(2024).status, 'ok');
  assert.equal(found(2025).status, 'ok');
  assert.equal(found(2023).status, 'ok');
  assert.equal(found(2015).status, 'ambiguous');
});

test('com ano, o remake nao rouba o lugar do original', () => {
  const result = pickMatch(
    [
      candidate({ tmdbId: 10, title: 'Cinderela', year: 2015, popularity: 99 }),
      candidate({ tmdbId: 20, title: 'Cinderela', year: 1950, popularity: 1 }),
    ],
    { title: 'Cinderela', year: 1950 }
  );

  assert.equal(result.status, 'ok');
  assert.equal(result.match.tmdbId, 20);
});

test('acento e pontuacao nao atrapalham o titulo', () => {
  const result = pickMatch(
    [candidate({ title: 'Batman: O Cavaleiro das Trevas', year: 2008 })],
    { title: 'Batman - O Cavaleiro das Trevas', year: 2008 }
  );

  assert.equal(result.status, 'ok');
});

test('sem ano, titulo unico passa; empatado nao', () => {
  const unico = pickMatch([candidate({ title: 'O Poderoso Chefao' })], {
    title: 'O Poderoso Chefao',
    year: null,
  });
  const empate = pickMatch(
    [candidate({ title: 'Anne', popularity: 5 }), candidate({ title: 'Anne', popularity: 4 })],
    { title: 'Anne', year: null }
  );
  const folgado = pickMatch(
    [candidate({ title: 'Anne', popularity: 50 }), candidate({ title: 'Anne', popularity: 4 })],
    { title: 'Anne', year: null }
  );

  assert.equal(unico.status, 'ok');
  assert.equal(empate.status, 'ambiguous');
  assert.equal(folgado.status, 'ok');
});

test('sem ano e sem titulo exato, nao arrisca', () => {
  const result = pickMatch([candidate({ title: 'Outra Coisa' })], { title: 'Anne', year: null });
  assert.equal(result.status, 'ambiguous');
});

test('coletanea nem chega a consultar', async () => {
  const { getJson, calls } = fakeJson();
  const tmdb = createTmdb({ getJson, apiKey: 'k', language: 'pt-BR' });

  const titles = ['Homem de Ferro Trilogia', 'Kung Fu Panda Coleção', 'Coleção - Loucademia'];
  for (const title of titles) {
    assert.equal((await tmdb.search({ type: 'movie', title, year: null })).status, 'skipped');
  }

  // Nem a busca, nem o dicionario de generos: coletanea nao gasta requisicao.
  assert.deepEqual(calls, []);
});

test('a chave vai na url e o ano nao', async () => {
  const { getJson, calls } = fakeJson();
  const tmdb = createTmdb({ getJson, apiKey: 'chave', language: 'pt-BR' });

  await tmdb.search({ type: 'series', title: 'Dexter', year: 2006 });

  const busca = calls.at(-1);
  assert.match(busca.pathname, /search\/tv$/);
  assert.equal(busca.searchParams.get('api_key'), 'chave');
  assert.equal(busca.searchParams.get('query'), 'Dexter');
  assert.equal(busca.searchParams.get('year'), null);
});

test('o trailer e procurado uma vez por obra, e so para quem casou', async () => {
  const { getJson, calls } = fakeJson([
    { id: 9, title: 'Interestelar', release_date: '2014-11-05' },
  ]);
  const tmdb = createTmdb({ getJson, apiKey: 'k', language: 'pt-BR' });

  const primeira = await tmdb.search({ type: 'movie', title: 'Interestelar', year: 2014 });
  const detalhe = () => calls.filter((u) => u.pathname === '/3/movie/9').length;

  assert.equal(detalhe(), 1, 'a busca nao traz video: precisa da chamada de detalhe');
  assert.equal(primeira.match.trailerChecked, 1);

  // Numa revalidacao a obra ja vem marcada, e a segunda chamada nao acontece.
  await tmdb.search({ type: 'movie', title: 'Interestelar', year: 2014, trailerChecked: 1 });
  assert.equal(detalhe(), 1, 'procurar trailer de novo custaria o dobro por obra');

  // Quem nao casou nunca chega a pagar a segunda chamada.
  calls.length = 0;
  const semMatch = await tmdb.search({ type: 'movie', title: 'Nao Existe', year: 1999 });
  assert.equal(semMatch.status, 'ambiguous');
  assert.deepEqual(calls.map((u) => u.pathname), ['/3/search/movie']);
});

test('o dicionario de generos e buscado uma vez por tipo, nao por obra', async () => {
  const { getJson, calls } = fakeJson();
  const tmdb = createTmdb({ getJson, apiKey: 'k', language: 'pt-BR' });

  for (const title of ['A', 'B', 'C']) await tmdb.search({ type: 'movie', title, year: 2020 });
  await tmdb.search({ type: 'series', title: 'D', year: 2020 });

  const dicionarios = calls.filter((u) => u.pathname.includes('/genre/'));
  assert.equal(dicionarios.length, 2, 'um para filme, um para serie');
  assert.deepEqual(
    dicionarios.map((u) => u.pathname),
    ['/3/genre/movie/list', '/3/genre/tv/list']
  );
});

test('entre dezenas de videos, escolhe trailer dublado e oficial', () => {
  const v = (over) => ({ site: 'YouTube', key: 'k', official: false, ...over });

  // Clipe e bastidor nao servem, mesmo dublados e oficiais.
  assert.equal(pickTrailer([v({ type: 'Clip', iso_639_1: 'pt', official: true })]), null);
  assert.equal(pickTrailer([]), null);

  // Trailer ganha de teaser; pt ganha de en; oficial desempata.
  const escolhido = pickTrailer([
    v({ type: 'Teaser', key: 'teaser', iso_639_1: 'pt' }),
    v({ type: 'Trailer', key: 'en', iso_639_1: 'en', official: true }),
    v({ type: 'Trailer', key: 'pt', iso_639_1: 'pt', official: true }),
  ]);
  assert.equal(escolhido, 'pt');

  // Video fora do YouTube nao vira link, mesmo sendo trailer.
  assert.equal(pickTrailer([{ site: 'Vimeo', type: 'Trailer', key: 'x', iso_639_1: 'pt' }]), null);
});

test('o id do genero vira nome', async () => {
  const { getJson } = fakeJson([
    { id: 9, title: 'Invocação do Mal', release_date: '2013-07-18', genre_ids: [27, 53, 999] },
  ]);
  const tmdb = createTmdb({ getJson, apiKey: 'k', language: 'pt-BR' });

  const { match } = await tmdb.search({ type: 'movie', title: 'Invocação do Mal', year: 2013 });

  // O 999 nao esta no dicionario e some, em vez de virar undefined na lista.
  assert.deepEqual(match.genres, ['Terror', 'Thriller']);
});

// --- o passo completo, sobre o banco ---

const item = (sourceId, { title, year = 2020, type = 'movie' }) => ({
  sourceId,
  infohash: sourceId,
  name: title,
  sizeBytes: 1,
  createdUnix: 1,
  seeders: 1,
  leechers: 0,
  release: {
    canonical: title,
    title,
    year,
    type,
    season: null,
    episode: null,
    resolution: null,
    source: null,
    videoCodec: null,
    audio: [],
    hdr: [],
  },
});

const fakeTmdb = (byTitle) => ({
  calls: [],
  async search(work) {
    this.calls.push(work.title);
    return byTitle[work.title] ?? { status: 'not_found' };
  },
});

const withItems = (items) => {
  const db = openDb(':memory:');
  const repo = createRepo(db);
  repo.savePage('t', items);
  return { db, repo };
};

test('consulta obra distinta, nao torrent', async () => {
  const { db, repo } = withItems([
    item('a', { title: 'Divertida Mente' }),
    item('b', { title: 'Divertida Mente' }),
    item('c', { title: 'Divertida Mente' }),
  ]);
  const tmdb = fakeTmdb({ 'Divertida Mente': { status: 'ok', match: candidate() } });

  const total = await enrich({ repo, tmdb, config, log });

  assert.deepEqual(tmdb.calls, ['Divertida Mente']);
  assert.equal(total.ok, 1);
  db.close();
});

test('o que nao casou nao e reconsultado', async () => {
  const { db, repo } = withItems([
    item('a', { title: 'Hexalogia' }),
    item('b', { title: 'Anne' }),
  ]);
  const tmdb = fakeTmdb({ Anne: { status: 'ambiguous' } });

  await enrich({ repo, tmdb, config, log });
  tmdb.calls.length = 0;
  const segunda = await enrich({ repo, tmdb, config, log });

  assert.deepEqual(tmdb.calls, []);
  assert.equal(segunda.seen, 0);
  db.close();
});

test('obra casada volta a ser consultada quando a nota envelhece', async () => {
  const { db, repo } = withItems([item('a', { title: 'Filme' })]);
  const tmdb = fakeTmdb({ Filme: { status: 'ok', match: candidate() } });

  await enrich({ repo, tmdb, config, log });
  tmdb.calls.length = 0;

  // Envelhece a consulta em 40 dias: passa dos 30 de `staleDays`.
  const old = Math.floor(Date.now() / 1000) - 40 * 86400;
  db.prepare('UPDATE work SET checked_at = ?').run(old);

  await enrich({ repo, tmdb, config, log });

  assert.deepEqual(tmdb.calls, ['Filme']);
  db.close();
});

test('chave recusada para tudo em vez de marcar not_found', async () => {
  const { db, repo } = withItems([item('a', { title: 'A' }), item('b', { title: 'B' })]);
  const tmdb = {
    calls: 0,
    async search() {
      this.calls++;
      throw Object.assign(new Error('HTTP 401'), { status: 401, permanent: true });
    },
  };

  await assert.rejects(() => enrich({ repo, tmdb, config, log }), /TMDB_API_KEY/);

  assert.equal(tmdb.calls, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM work').get().c, 0);
  db.close();
});

test('erro pontual nao derruba o resto da fila', async () => {
  const { db, repo } = withItems([item('a', { title: 'Quebra' }), item('b', { title: 'Vai' })]);
  const tmdb = {
    async search(work) {
      if (work.title === 'Quebra') throw new Error('timeout');
      return { status: 'ok', match: candidate() };
    },
  };

  const total = await enrich({ repo, tmdb, config, log });

  assert.equal(total.failed, 1);
  assert.equal(total.ok, 1);
  db.close();
});

test('o que o enrich grava e o que a API mostra em /movies', async () => {
  const { db, repo } = withItems([
    item('a', { title: 'Com Capa' }),
    item('b', { title: 'Sem Capa' }),
  ]);
  const tmdb = fakeTmdb({
    'Com Capa': {
      status: 'ok',
      match: candidate({
        tmdbId: 42,
        title: 'Com Capa: O Filme',
        posterPath: '/p.jpg',
        rating: 8.1,
        genres: ['Terror', 'Thriller'],
      }),
    },
  });
  await enrich({ repo, tmdb, config, log });

  const app = await buildServer(repo);
  await app.ready();
  const { movies } = JSON.parse((await app.inject({ url: '/api/movies' })).payload);

  // So a obra que casou entra na listagem, com o titulo da TMDB.
  assert.deepEqual(movies.map((m) => m.title), ['Com Capa: O Filme']);
  assert.equal(movies[0].poster, 'https://image.tmdb.org/t/p/w185/p.jpg');
  assert.equal(movies[0].backdrop, 'https://image.tmdb.org/t/p/w780/b.jpg');
  assert.equal(movies[0].rating, 8.1);

  const detalhe = JSON.parse((await app.inject({ url: `/api/movies/${movies[0].id}` })).payload);
  assert.deepEqual(detalhe.genres, ['Terror', 'Thriller']);
  assert.equal(detalhe.backdrop, 'https://image.tmdb.org/t/p/w1280/b.jpg');

  // O status sustenta o cache, mas nao vai para o cliente.
  const status = db.prepare('SELECT title, status FROM work ORDER BY title').all();
  assert.deepEqual(status, [
    { title: 'Com Capa', status: 'ok' },
    { title: 'Sem Capa', status: 'not_found' },
  ]);
  db.close();
});
