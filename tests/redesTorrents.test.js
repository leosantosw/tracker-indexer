'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const source = require('../src/sources/redesTorrents');
const { base32ToHex } = require('../src/lib/infohash');
const { sizeToBytes } = require('../src/lib/size');

const card = (slug, titulo, tipo) => `
  <div class="col">
    <a href="https://redestorrents.com/${slug}/" class="text-decoration-none cover-link" title="${titulo}">
      <article class="custom-card" data-title="${titulo}" data-tipo="${tipo}" data-genero="Ação">
        <div class="cover-wrapper"><span class="cover-badge badge-tipo">${tipo}</span></div>
      </article>
    </a>
  </div>`;

const LISTA = `<html><body>
  ${card('filme-a', 'Filme A', 'Filmes')}
  ${card('serie-b', 'Serie B - 1ª Temporada', 'Séries')}
  ${card('desenho-c', 'Desenho C - 2ª Temporada', 'Desenhos')}
  ${card('filme-d', 'Filme D', 'Filmes')}
</body></html>`;

const detalhe = (hash, dn, tamanho) => `<html><body>
  <div class="spec-card-glass"><div class="spec-text">
    <small>Tamanho do Arquivo</small><strong>${tamanho}</strong>
  </div></div>
  <a href="magnet:?xt=urn:btih:${hash}&amp;tr=udp%3A%2F%2Ftracker%3A80&amp;dn=${dn}">Baixar</a>
</body></html>`;

/** Reads one listing (and the detail pages it links) through the real source. */
const readPage = (pages) =>
  source.create({ getText: async (url) => pages[url] ?? '<html></html>' }).readPage(1);

const LIST_URL = 'https://redestorrents.com/pagina/1/';
const onlyFilmeA = `<html><body>${card('filme-a', 'Filme A', 'Filmes')}</body></html>`;

/** The item the source builds for "Filme A" given its detail page. */
const itemOf = async (detailHtml) =>
  (await readPage({ [LIST_URL]: onlyFilmeA, 'https://redestorrents.com/filme-a/': detailHtml }))[0];

test('base32 do site vira o hex que o resto do catalogo usa', () => {
  assert.equal(base32ToHex('A'.repeat(32)), '0'.repeat(40));
  assert.equal(
    base32ToHex('7cfoc7xog7x6yohgbnpoia355doepjt7'),
    'f88ae17eee37efec38e60b5ee4037de8dc47a67f'
  );
  assert.equal(base32ToHex('1111111111111111111111111111111'), null, 'fora do alfabeto base32');
});

test('tamanho em texto vira bytes', () => {
  assert.equal(sizeToBytes('2.69 GB'), 2888365507);
  assert.equal(sizeToBytes('700 MB'), 734003200);
  assert.equal(sizeToBytes('1,5 GB'), 1610612736, 'virgula tambem e decimal');
  assert.equal(sizeToBytes('sem tamanho'), null);
  assert.equal(sizeToBytes(undefined), null);
});

test('a listagem entrega link, titulo e tipo de cada cartao', async () => {
  const entries = await readPage({ [LIST_URL]: LISTA });
  const { url, title, kind } = entries[0].card;

  assert.equal(entries.length, 4);
  assert.deepEqual({ url, title, kind }, {
    url: 'https://redestorrents.com/filme-a/',
    title: 'Filme A',
    kind: 'Filmes',
  });
});

test('o titulo limpo entra na frente das marcas do magnet', async () => {
  const dn = 'SITE.COM-.WEB-DL.1080P.MKV.-DUBLADO-.Filme+A.2024.1080p.WEB-DL.x264';
  const { item: found } = await itemOf(detalhe('7cfoc7xog7x6yohgbnpoia355doepjt7', dn, '2.69 GB'));

  assert.equal(found.infohash, 'f88ae17eee37efec38e60b5ee4037de8dc47a67f');
  assert.equal(found.sizeBytes, 2888365507);
  assert.ok(found.name.startsWith('Filme A.'), 'sem isso o classificador corta o titulo nas tags');
});

test('o nome composto vira titulo e marcas corretos no classificador', async () => {
  const { classify } = require('../src/lib/classifier');
  const dn = 'SITE.COM-.WEB-DL.1080P.MKV.5.1.-DUBLADO-DUAL-AUDIO-.Filme+A.2024.1080p.WEB-DL.x264';
  const { name } = (await itemOf(detalhe('A'.repeat(32), dn, '2.69 GB'))).item;

  const release = classify(name);

  assert.equal(release.rejected, false);
  assert.equal(release.title, 'Filme A');
  assert.equal(release.year, 2024);
  assert.equal(release.resolution, '1080p');
  assert.equal(release.source, 'WEB-DL');
});

test('pagina sem magnet nao vira item', async () => {
  const semMagnet = await itemOf('<html>nada aqui</html>');
  const hashInvalido = await itemOf(detalhe('hash-invalido', 'Filme+A', '1 GB'));

  assert.deepEqual([semMagnet.item, semMagnet.status], [null, 'no-magnet']);
  assert.deepEqual([hashInvalido.item, hashInvalido.status], [null, 'no-magnet']);
});

/** getText falso: uma listagem e as paginas de detalhe dos dois filmes. */
const fakeHttp = () => {
  const calls = [];
  const paginas = {
    'https://redestorrents.com/pagina/1/': LISTA,
    'https://redestorrents.com/filme-a/': detalhe('A'.repeat(32), 'S.COM-.WEB-DL.1080P.-.Filme+A.2024.1080p.WEB-DL', '2.69 GB'),
    'https://redestorrents.com/filme-d/': detalhe('B'.repeat(32), 'S.COM-.WEB-DL.1080P.-.Filme+D.2023.1080p.WEB-DL', '1.20 GB'),
  };
  return {
    calls,
    getText: async (url) => {
      calls.push(url);
      if (!(url in paginas)) throw new Error(`pagina inesperada: ${url}`);
      return paginas[url];
    },
  };
};

test('serie fica de fora ate haver desenho para um torrent por episodio', async () => {
  const http = fakeHttp();
  const { items } = await source.create(http).fetchPage({ cursor: 1 });

  assert.equal(items.length, 2);
  assert.equal(
    http.calls.some((u) => u.includes('serie-b') || u.includes('desenho-c')),
    false,
    'nem chega a abrir a pagina da serie'
  );
});

test('o cursor avanca enquanto a pagina render cartoes', async () => {
  const http = fakeHttp();
  const { nextCursor } = await source.create(http).fetchPage({ cursor: 1 });
  assert.equal(nextCursor, '2');

  const vazia = { getText: async () => '<html></html>' };
  assert.equal((await source.create(vazia).fetchPage({ cursor: 9 })).nextCursor, null);
});

test('pagina que rende cartao mas nenhum magnet avisa no log', async () => {
  const avisos = [];
  const semMagnet = {
    getText: async (url) => (url.includes('/pagina/') ? LISTA : '<html>template novo</html>'),
  };

  const { items } = await source.create(semMagnet).fetchPage({ cursor: 1, log: (m) => avisos.push(m) });

  assert.deepEqual(items, []);
  assert.equal(avisos.length, 1);
  assert.match(avisos[0], /template mudou/);
});

test('o source nao promete seeders que o site nao publica', () => {
  const item = source.create(fakeHttp()).toItem({ infohash: 'x', name: 'n', sizeBytes: 1 });

  assert.equal(item.seeders, null);
  assert.equal(item.leechers, null);
  assert.equal(source.rules.dedupe, undefined, 'dedupe por seeders nao faz sentido sem seeders');
});
