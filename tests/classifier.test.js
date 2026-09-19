'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const { classify } = require('../src/lib/classifier');

// Nomes reais, vindos da base sincronizada do torrents-csv.
const ACEITOS = [
  'Procurando Nemo 2003 Dublado 720p BRrip x264',
  'As Polacas 2024 WEB-DL 1080p x264 NACIONAL 5.1',
  'Chapolin Colorado Completo Dublado TVRip',
  'Pernalonga e Sua Turma Completo AVI Dublado 227 Ep.',
];

const REJEITADOS = [
  ['Windows 10 PRO PT-BR x64 ISO', 'sem formato de filme'],
  ['Corel DRAW Graphics Suite X6 Installer (PTBR KeyGen 32-64Bit)', 'sem formato de filme'],
  ['Resident Evil PS1 Trilogia Dublada Pt-Br', 'sem formato de filme'],
  ['Portugues Empresarial.rar', 'sem formato de filme'],
  ['One Battle After Another (2025) 1080p TC [Dublado PT-BR] FBS', 'fonte TC'],
  ['John Wick: Chapter 4 (2023) 1080p HDCAM [Dublado Portugues] MOSTBET', 'fonte CAM'],
  ['Companion (2025) 1080p HDTS [Dublado PT-BR] HELLCASE', 'fonte TS'],
];

test('aceita o que tem formato de filme', () => {
  for (const name of ACEITOS) {
    assert.equal(classify(name).rejected, false, name);
  }
});

test('rejeita o que nao tem formato, e as capturas de cinema', () => {
  for (const [name, reason] of REJEITADOS) {
    const result = classify(name);
    assert.equal(result.rejected, true, name);
    assert.equal(result.reason, reason, name);
  }
});

test('extrai as marcas de release', () => {
  const r = classify('Breaking Bad S05E14 1080p BluRay x265 HEVC DDP5.1 Atmos HDR10+');

  assert.equal(r.resolution, '1080p');
  assert.equal(r.source, 'BluRay');
  assert.equal(r.videoCodec, 'x265');
  assert.deepEqual(r.audio, ['Atmos', 'DDP']);
  assert.deepEqual(r.hdr, ['HDR10+']);
});

test('marcas com simbolo sobrevivem a normalizacao', () => {
  assert.deepEqual(classify('Filme 2024 1080p WEB-DL HDR10+ DD+5.1').hdr, ['HDR10+']);
  assert.deepEqual(classify('Filme 2024 1080p WEB-DL HDR10 DTS-HD').hdr, ['HDR10']);
  assert.equal(classify('Filme 2024 1080p WEB-DL H.264').videoCodec, 'x264');
  assert.equal(classify('Filme 2024 1080p Dolby Vision WEB-DL').hdr[0], 'Dolby Vision');
});

test('reconhece serie nas tres formas de temporada', () => {
  assert.deepEqual(pick(classify('Breaking Bad S05E14 1080p WEB-DL')), ['series', 5, 14]);
  assert.deepEqual(pick(classify('Dois Homens e Meio - 12a Temporada (2015) 720p')), ['series', 12, null]);
  assert.deepEqual(pick(classify('Friends Temporada 3 1080p BluRay')), ['series', 3, null]);
  assert.deepEqual(pick(classify('Procurando Nemo 2003 720p BRrip')), ['movie', null, null]);
});

const pick = (r) => [r.type, r.season, r.episode];

test('normaliza o titulo num padrao', () => {
  assert.equal(
    classify('Procurando Nemo 2003 Dublado 720p BRrip x264').canonical,
    'Procurando Nemo (2003) 720p BRRip x264'
  );

  // tag de site e entity HTML nao entram no titulo
  assert.equal(
    classify('[ACESSE COMANDOTORRENTS.COM] No Manches Frida 2 2019 [720p] WEB-DL').title,
    'No Manches Frida 2'
  );
  assert.equal(classify('Todo Mundo em P&acirc;nico 3 (2003) 720p dublado').title, 'Todo Mundo em Pânico 3');
});

test('o nome normalizado traz a temporada de volta', () => {
  const casos = [
    ['Westworld.S01E09.MKV-TORRENTDOSFILMES', 'Westworld S01E09'],
    ['Cangaco Novo S02 2026 1080p WEB-DL x265', 'Cangaco Novo S02 (2026) 1080p WEB-DL x265'],
    ['Serie X S2 720p WEB-DL', 'Serie X S02 720p WEB-DL'],
  ];
  for (const [nome, esperado] of casos) {
    assert.equal(classify(nome).canonical, esperado, nome);
  }
});

test('marca mais especifica anula a generica', () => {
  assert.deepEqual(classify('Filme 2024 2160p WEB-DL DTS-HD DTS').audio, ['DTS-HD']);
  assert.deepEqual(classify('Filme 2024 2160p WEB-DL HDR10+ HDR10').hdr, ['HDR10+']);
});

// Cada caso abaixo foi um bug real encontrado na base sincronizada.
test('limpa o ruido que sobrava no titulo', () => {
  const casos = [
    // dominio no inicio deixava o titulo comecando com "-"
    [
      'www.UIndex.org    -    The Warning Live From Auditorio Nacional CDMX (2025) 2160p 4K WEB 5.1-WORLD',
      'The Warning Live From Auditorio Nacional CDMX',
    ],
    // colchete malformado ("[" fecha com "}") engolia o titulo inteiro
    ['[FênixFansub} Ijiranaide, Nagatoro-san [BD][1080p][FLAC][PT-BR]', 'Ijiranaide, Nagatoro-san'],
    // grupo sem dominio junto
    ['No Coração do Mar  [3D] [1080p] BLUDV', 'No Coração do Mar'],
    // container vazava para o titulo
    ['[Darkmahou.io] One Piece - 1168 [1080p HEVC][PT-BR].mkv', 'One Piece'],
    // parentese sem par + resolucao nao reconhecida
    [
      '[SubVision] Kaoru Hana wa Rin to Saku - 12v2 [PT-BR] (WEB 1920x1080 x264 8Bit AAC) [A5331F5E].mkv',
      'Kaoru Hana wa Rin to Saku',
    ],
  ];

  for (const [nome, esperado] of casos) {
    assert.equal(classify(nome).title, esperado, nome);
  }
});

test('numeracao de anime vira episodio', () => {
  assert.equal(classify('[Darkmahou.io] One Piece - 1168 [1080p HEVC].mkv').episode, 1168);
  assert.equal(classify('[SubVision] Kaoru - 12v2 [PT-BR] (WEB 1920x1080 x264)').episode, 12);
  assert.equal(classify('[SubVision] Kaoru 01-13 [PT-BR] (WEB 1920x1080 x264)').episode, null);
});

test('reconhece resolucao escrita como 1920x1080', () => {
  assert.equal(classify('Filme (WEB 1920x1080 x264)').resolution, '1080p');
  assert.equal(classify('Filme (WEB 1280x720 x264)').resolution, '720p');
});

test('nome vazio nao quebra', () => {
  assert.equal(classify('').rejected, true);
  assert.equal(classify(null).rejected, true);
});
