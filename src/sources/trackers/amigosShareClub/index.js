'use strict';

const { createInertiaSession } = require('../../private/inertiaSession');
const { releaseName } = require('./releaseName');

const BASE_URL = 'https://amigos-share.club';
const PER_PAGE = 96;

const CATEGORIES = {
  filmes: 4,
  'anime-filmes': 59,
  series: 3,
  'anime-series': 61,
};

const CONTENT_CATEGORIES = {
  movies: ['filmes', 'anime-filmes'],
  series: ['series', 'anime-series'],
  both: ['filmes', 'anime-filmes', 'series', 'anime-series'],
};

const LANGUAGE = { 'Dual Áudio': 'dual', Dublado: 'dubbed', Legendado: 'subtitled' };

const noneKnown = async () => new Set();

const languageOf = (badges = []) => LANGUAGE[badges.find((badge) => badge.kind === 'audio')?.label] ?? null;

const imdbOf = (value) => {
  const digits = /^(?:tt)?(\d{5,10})$/i.exec(String(value ?? '').trim())?.[1];
  return digits ? `tt${digits.padStart(7, '0')}` : null;
};

const unixOf = (date) => {
  const time = Date.parse(date);
  return Number.isNaN(time) ? null : Math.floor(time / 1000);
};

function listQuery(term, page, freeleechOnly) {
  const query = new URLSearchParams({ category: String(CATEGORIES[term]), per_page: String(PER_PAGE), page: String(page) });
  if (freeleechOnly) query.set('freeleech', '1');
  return `/torrents?${query}`;
}

function create(http, settings = {}) {
  const session = createInertiaSession({ baseUrl: BASE_URL, http, credentials: settings.credentials });

  async function filesOf(id, props) {
    const first = props.files?.data ?? [];
    const lastPage = props.files?.last_page ?? 1;
    if (lastPage <= 1) return first;

    const last = await session.page(`/torrents/${id}?filesPage=${lastPage}`);
    return [...first, ...(last.props.files?.data ?? [])];
  }

  async function readTorrent(listed) {
    const { props } = await session.page(`/torrents/${listed.id}`);
    const files = await filesOf(listed.id, props);
    return {
      id: listed.id,
      infohash: props.torrent.infoHash?.toLowerCase() ?? null,
      imdbId: imdbOf(props.torrent.imdbId),
      name: releaseName(listed, files),
      sizeBytes: listed.size ?? null,
      createdUnix: unixOf(listed.releasedAt),
      seeders: listed.seeders ?? null,
      leechers: listed.leechers ?? null,
      language: languageOf(listed.badges),
    };
  }

  async function fetchPage({ term, cursor, isKnown = noneKnown, limit = Infinity }) {
    const page = Number(cursor ?? 1);
    const { props } = await session.page(listQuery(term, page, settings.freeleechOnly));
    const listing = props.torrents;

    const known = await isKnown(listing.data.map((row) => String(row.id)));
    const fresh = listing.data.filter((row) => !known.has(String(row.id))).slice(0, limit);

    const items = [];
    for (const row of fresh) items.push(await readTorrent(row));

    return { items, nextCursor: listing.current_page < listing.last_page ? String(page + 1) : null };
  }

  const toItem = (raw) => ({
    sourceId: String(raw.id),
    infohash: raw.infohash,
    name: raw.name,
    sizeBytes: raw.sizeBytes,
    createdUnix: raw.createdUnix,
    seeders: raw.seeders,
    leechers: raw.leechers,
    imdbId: raw.imdbId,
    language: raw.language,
  });

  return { terms: CONTENT_CATEGORIES[settings.content] ?? CONTENT_CATEGORIES.both, fetchPage, toItem };
}

module.exports = {
  name: 'amigos-share-club',
  site: BASE_URL,
  access: 'private',
  requiresLogin: true,
  rps: 1,
  pages: 3,
  stopAfterQuietPages: 2,
  content: 'both',
  freeleechOnly: false,
  rules: { requireYear: true },
  create,
};
