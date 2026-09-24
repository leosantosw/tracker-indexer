'use strict';

const { normalizeInfohash } = require('../../lib/infohash');

const KB = 1024;

// O banco guarda so o caminho; o tamanho e escolhido aqui, sem reprocessar
// nada. A grade da TV usa imagens menores que a tela do item aberto.
const TMDB_IMAGES = 'https://image.tmdb.org/t/p/';
const SIZES = {
  card: { poster: 'w185', backdrop: 'w780' },
  detail: { poster: 'w342', backdrop: 'w1280' },
};

const image = (size, path) => (path ? `${TMDB_IMAGES}${size}${path}` : null);

// O banco guarda so o id do video; a URL do YouTube se monta aqui.
const YOUTUBE = 'https://www.youtube.com/watch?v=';

/** Tamanho legivel: GB acima de 1 GB, MB abaixo. */
function formatSize(bytes) {
  if (bytes === null || bytes === undefined) return null;
  const mb = bytes / (KB * KB);
  return mb >= KB ? `${(mb / KB).toFixed(2)} GB` : `${mb.toFixed(2)} MB`;
}

const isoDate = (unix) => new Date(unix * 1000).toISOString();

/** A copia: o que muda de release para release. O nome vem normalizado. */
const toTorrent = (row, cachedByHash = {}) => ({
  id: row.id,
  name: row.name,
  // season/episode so existem em serie; em filme sao sempre null.
  ...(row.type === 'series' ? { season: row.season, episode: row.episode } : {}),
  seeders: row.seeders,
  leechers: row.leechers,
  size: formatSize(row.size_bytes),
  resolution: row.resolution,
  release: row.release_source,
  videoCodec: row.video_codec,
  audio: row.audio,
  hdr: row.hdr,
  infohash: row.infohash,
  source: row.source,
  createdAt: isoDate(row.created_at),
  updatedAt: isoDate(row.updated_at),
  cached: cachedByHash[normalizeInfohash(row.infohash)] ?? null,
});

// Mesma regra do SQL: sem votacao suficiente, nao ha nota para divulgar.
const ratingOf = (row, minVotes) => (row.votes >= minVotes ? row.rating : null);

/** O cartao da grade: o minimo para desenhar a capa e o fundo do item em foco. */
const toWorkCard = (row, minVotes) => ({
  id: row.id,
  title: row.title,
  year: row.year,
  poster: image(SIZES.card.poster, row.poster_path),
  backdrop: image(SIZES.card.backdrop, row.backdrop_path),
  rating: ratingOf(row, minVotes),
});

/**
 * A obra aberta, com as copias dentro. `release_date`, `last_added` e
 * `status` ficam de fora de proposito -- servem ao SQL, nao ao payload.
 */
const toWorkDetail = (row, minVotes, torrents, cachedByHash) => ({
  id: row.id,
  title: row.title,
  year: row.year,
  genres: row.genres ? row.genres.split(', ') : [],
  poster: image(SIZES.detail.poster, row.poster_path),
  backdrop: image(SIZES.detail.backdrop, row.backdrop_path),
  overview: row.overview,
  rating: ratingOf(row, minVotes),
  votes: row.votes,
  trailer: row.trailer_key ? YOUTUBE + row.trailer_key : null,
  torrents: torrents.map((torrent) => toTorrent(torrent, cachedByHash)),
});

module.exports = { toWorkCard, toWorkDetail };
