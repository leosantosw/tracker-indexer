'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const { releaseName } = require('../src/sources/trackers/amigosShareClub/releaseName');
const { classify } = require('../src/lib/classifier');

const listed = (name, year = 2026) => ({ name, year });
const files = (...paths) => paths.map((path) => ({ path, size: 1 }));

test('filme de um arquivo: o nome do arquivo, sem a extensão', () => {
  const name = releaseName(listed('Toy Story 5'), files('Toy.Story.5.2026.2160p.UHD.BluRay.TrueHD.7.1.Atmos.DV.HDR.x265.DUAL-FRNcR.mkv'));

  assert.equal(name, 'Toy.Story.5.2026.2160p.UHD.BluRay.TrueHD.7.1.Atmos.DV.HDR.x265.DUAL-FRNcR');
  assert.deepEqual(pick(classify(name)), { type: 'movie', title: 'Toy Story 5', year: 2026, season: null, episode: null });
});

test('episódio de novela vira série com temporada e episódio', () => {
  const name = releaseName(listed('Quem Ama Cuida - S01E114'), files('Quem.Ama.Cuida.S01E114.Capitulo.de.28.09.2026.2160p.GLBO.WEB-DL.DDP5.1.Atmos.HDR.HEVC.DUAL-andrehsa.mkv'));

  assert.deepEqual(pick(classify(name)), { type: 'series', title: 'Quem Ama Cuida', year: 2026, season: 1, episode: 114 });
});

test('pacote de uma temporada: o episódio do primeiro arquivo vira a temporada', () => {
  const name = releaseName(
    listed('Habeas Corpus - S01'),
    files('.pad/1215765', 'Habeas.Corpus.S01E01.1080p.NF.WEB-DL.DDP5.1.Atmos.H.264-BiOMA.mkv', 'Habeas.Corpus.S01E02.1080p.NF.WEB-DL.DDP5.1.Atmos.H.264-BiOMA.srt')
  );

  assert.equal(name, 'Habeas.Corpus.S01.1080p.NF.WEB-DL.DDP5.1.Atmos.H.264-BiOMA');
  assert.deepEqual(pick(classify(name)), { type: 'series', title: 'Habeas Corpus', year: null, season: 1, episode: null });
});

test('pacote completo junta a primeira e a última página dos arquivos na faixa de temporadas', () => {
  const firstPage = files(
    '.pad/1215765',
    'Better.Call.Saul.S01.1080p.H264.WEB-DL.DUAL-SF/Better.Call.Saul.S01E01.1080p.H264.DUAL-SF.Dual-Yaboku.mkv'
  );
  const lastPage = files('Better.Call.Saul.S06.1080p.H264.WEB-DL.DUAL-SF/Better.Call.Saul.S06E13.1080p.H264.DUAL-SF.Dual-Yaboku.mkv');

  const release = classify(releaseName(listed('Better Call Saul - Completo'), [...firstPage, ...lastPage]));

  assert.deepEqual({ title: release.title, season: release.season, seasonEnd: release.seasonEnd }, { title: 'Better Call Saul', season: 1, seasonEnd: 6 });
});

test('torrent com dois episódios fica com a faixa da listagem, não vira pacote', () => {
  const name = releaseName(
    listed('Irmãos - S01E01-02'),
    files('Brothers.S01E01.1080p.WEB-DL.DUAL.mkv', 'Brothers.S01E02.1080p.WEB-DL.DUAL.mkv')
  );

  const release = classify(name);
  assert.deepEqual({ season: release.season, episode: release.episode, episodeEnd: release.episodeEnd }, { season: 1, episode: 1, episodeEnd: 2 });
});

test('sem arquivo de vídeo, usa o nome da listagem com o ano', () => {
  assert.equal(releaseName(listed('Kit de correção do Windows 11', 2025), files('setup.exe')), 'Kit de correção do Windows 11 2025');
});

function pick(release) {
  return { type: release.type, title: release.title, year: release.year, season: release.season, episode: release.episode };
}

const tracker = require('../src/sources/trackers/amigosShareClub');

const pageHtml = (page) => `<html><script data-page="app" type="application/json">${JSON.stringify(page)}</script></html>`;

const LISTED = [
  { id: 101, name: 'Toy Story 5', year: 2026, size: 26801697545, seeders: 81, leechers: 2, releasedAt: '2026-09-29', badges: [{ kind: 'audio', label: 'Dual Áudio' }] },
  { id: 102, name: 'Era Uma Vez em Nova York (The Immigrant)', year: 2013, size: 7541451212, seeders: 2, leechers: 0, releasedAt: '2026-09-28', badges: [{ kind: 'audio', label: 'Dublado' }] },
];

const DETAILS = {
  101: { infoHash: 'AB'.repeat(20), imdbId: 'tt29355505', files: ['Toy.Story.5.2026.2160p.UHD.BluRay.x265.DUAL-FRNcR.mkv'] },
  102: { infoHash: 'CD'.repeat(20), imdbId: 'tt1951181', files: ['Era.Uma.Vez.em.Nova.York.2013.1080p.AMZN.WEB-DL.H264.DUAL-andrehsa.mkv'] },
};

function fakeTrackerSite() {
  const requests = [];
  async function send(url, init = {}) {
    const { pathname, searchParams } = new URL(url);
    requests.push({ method: init.method ?? 'GET', pathname, query: Object.fromEntries(searchParams) });
    if (pathname === '/login' && !init.method) return new Response(pageHtml({ version: 'v1', props: {} }), { headers: { 'set-cookie': 'XSRF-TOKEN=t; path=/' } });
    if (pathname === '/login') return new Response(null, { status: 302, headers: { location: 'https://amigos-share.club/dashboard' } });
    if (pathname === '/torrents') {
      return new Response(pageHtml({ props: { torrents: { data: LISTED, current_page: Number(searchParams.get('page')), last_page: 3 } } }));
    }
    const detail = DETAILS[pathname.split('/').pop()];
    return new Response(
      pageHtml({ props: { torrent: { infoHash: detail.infoHash, imdbId: detail.imdbId }, files: { data: detail.files.map((path) => ({ path })), last_page: 1 } } })
    );
  }
  return { send, requests };
}

const credentials = { username: 'leo', password: 'segredo' };

test('lê a listagem, pula o que já conhece e monta o item a partir do detalhe', async () => {
  const site = fakeTrackerSite();
  const source = tracker.create(site, { credentials, content: 'movies' });

  const page = await source.fetchPage({ term: 'filmes', cursor: null, isKnown: async () => new Set(['102']) });

  assert.deepEqual(source.terms, ['filmes', 'anime-filmes']);
  assert.equal(page.nextCursor, '2');
  assert.equal(page.items.length, 1);
  assert.deepEqual(source.toItem(page.items[0]), {
    sourceId: '101',
    infohash: 'ab'.repeat(20),
    name: 'Toy.Story.5.2026.2160p.UHD.BluRay.x265.DUAL-FRNcR',
    sizeBytes: 26801697545,
    createdUnix: Date.parse('2026-09-29') / 1000,
    seeders: 81,
    leechers: 2,
    imdbId: 'tt29355505',
    language: 'dual',
  });
  const details = site.requests.filter((request) => /^\/torrents\/\d+$/.test(request.pathname));
  assert.deepEqual(details.map((request) => request.pathname), ['/torrents/101'], 'o conhecido não pede detalhe');
  assert.deepEqual(site.requests.find((request) => request.pathname === '/torrents').query, { category: '4', per_page: '96', page: '1' });
});

test('apenas freeleech pede o filtro ao site; o teste lê só alguns detalhes', async () => {
  const site = fakeTrackerSite();
  const source = tracker.create(site, { credentials, content: 'both', freeleechOnly: true });

  const page = await source.fetchPage({ term: 'anime-series', cursor: '3', limit: 1 });

  assert.deepEqual(source.terms, ['filmes', 'anime-filmes', 'series', 'anime-series']);
  assert.equal(page.nextCursor, null, 'a última página encerra');
  assert.equal(page.items.length, 1);
  assert.deepEqual(site.requests.find((request) => request.pathname === '/torrents').query, { category: '61', per_page: '96', page: '3', freeleech: '1' });
});

test('o tracker se declara privado, com login e com a opção de freeleech', () => {
  assert.equal(tracker.access, 'private');
  assert.equal(tracker.requiresLogin, true);
  assert.equal(tracker.freeleechOnly, false);
  assert.ok(tracker.rps <= 1, 'uma requisição por segundo, no máximo, para não pesar no site');
});

const TORRENT_BYTES = Buffer.from('d8:announce3:urle');

function fakeDownloadSite({ freeleech = true, unavailableReason = null, status = 200 } = {}) {
  const requests = [];
  async function send(url, init = {}) {
    const { pathname } = new URL(url);
    requests.push(pathname);
    if (pathname === '/login' && !init.method) return new Response(pageHtml({ version: 'v1', props: {} }), { headers: { 'set-cookie': 'XSRF-TOKEN=t; path=/' } });
    if (pathname === '/login') return new Response(null, { status: 302, headers: { location: 'https://amigos-share.club/dashboard' } });
    if (pathname === '/torrents/101/download') return new Response(TORRENT_BYTES, { headers: { 'content-type': 'application/x-bittorrent' } });
    if (status !== 200) return new Response('nao achei', { status });
    return new Response(pageHtml({ props: { torrent: { freeleech }, download: { url: '/torrents/101/download', unavailableReason } } }));
  }
  return { send, requests };
}

test('o .torrent só é baixado depois de conferir o freeleech na página', async () => {
  const site = fakeDownloadSite();
  const source = tracker.create(site, { credentials, freeleechOnly: true });

  const file = await source.torrentFile('101');

  assert.deepEqual(file, TORRENT_BYTES);
  assert.deepEqual(site.requests.slice(-2), ['/torrents/101', '/torrents/101/download']);
});

test('torrent que deixou de ser freeleech é recusado sem baixar o .torrent', async () => {
  const site = fakeDownloadSite({ freeleech: false });
  const source = tracker.create(site, { credentials, freeleechOnly: true });

  await assert.rejects(() => source.torrentFile('101'), { code: 'not_freeleech' });
  assert.ok(!site.requests.includes('/torrents/101/download'));
});

test('com a opção de freeleech desligada, baixa mesmo fora do freeleech', async () => {
  const source = tracker.create(fakeDownloadSite({ freeleech: false }), { credentials, freeleechOnly: false });

  assert.deepEqual(await source.torrentFile('101'), TORRENT_BYTES);
});

test('download bloqueado pelo site e torrent removido viram erros com código', async () => {
  const blocked = tracker.create(fakeDownloadSite({ unavailableReason: 'Você atingiu o limite de downloads' }), { credentials });
  const gone = tracker.create(fakeDownloadSite({ status: 404 }), { credentials });

  await assert.rejects(() => blocked.torrentFile('101'), { code: 'blocked', message: 'Você atingiu o limite de downloads' });
  await assert.rejects(() => gone.torrentFile('101'), { code: 'gone' });
});
