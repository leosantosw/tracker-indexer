'use strict';

const cheerio = require('cheerio');

const { readMagnet } = require('../../lib/infohash');
const { detectLanguage } = require('../../lib/classifier/language');
const { sizeToBytes } = require('../../lib/size');
const { wants } = require('../content');
const { readFields } = require('./select');

const toCount = (text) => {
  const value = Number(String(text ?? '').replace(/\D/g, ''));
  return text && Number.isFinite(value) ? value : null;
};

const cleanText = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();

function toRaw(card, link, nameOf) {
  const magnet = readMagnet(link.magnet);
  if (!magnet.infohash) return null;

  const name = cleanText(nameOf({ card, release: magnet.name ?? '', context: cleanText(link.context) }));
  if (!name) return null;

  return {
    infohash: magnet.infohash,
    name,
    sizeBytes: magnet.sizeBytes ?? sizeToBytes(link.context) ?? sizeToBytes(card.size),
    seeders: toCount(card.seeders),
    leechers: toCount(card.leechers),
    language: detectLanguage(link.context) ?? link.language ?? null,
  };
}

const linkOf = ($page, a, language) => ({ magnet: $page(a).attr('href'), context: $page(a).parent().text(), language });

function readMagnets($page, { magnets, sections, isSection = () => true }) {
  if (!sections) return $page(magnets).toArray().map((a) => linkOf($page, a, null));

  const links = [];
  let language = null;
  for (const node of $page(`${sections}, ${magnets}`).toArray()) {
    const text = cleanText($page(node).text());
    if ($page(node).is(magnets)) links.push(linkOf($page, node, language));
    else if (isSection(text)) language = detectLanguage(text);
  }
  return links;
}

const uniqueByHash = (items) => [...new Map(items.map((item) => [item.infohash, item])).values()];

function defineHtmlSource({
  list,
  detail,
  kindOf = () => 'movie',
  nameOf = ({ release }) => release,
  extend,
  ...source
}) {
  function create(http, settings = {}) {
    const content = settings.content ?? source.content;
    const accept = (card) => wants(content, kindOf(card));

    async function readCard($row) {
      const card = readFields($row, list.fields);
      if (!detail || !accept(card)) return card;

      const $page = cheerio.load(await http.getText(card.url));
      return {
        ...card,
        ...readFields($page.root(), detail.fields ?? {}),
        ...(detail.magnets && { links: readMagnets($page, detail) }),
      };
    }

    function itemsOf(card) {
      const links = card.links ?? [{ magnet: card.magnet, context: '' }];
      return uniqueByHash(links.map((link) => toRaw(card, link, nameOf)).filter(Boolean));
    }

    async function readPage(page) {
      const $ = cheerio.load(await http.getText(list.url(page)));
      const entries = [];

      for (const row of $(list.rows).toArray()) {
        const card = await readCard($(row));
        if (!accept(card)) {
          entries.push({ card, item: null, status: 'filtered' });
          continue;
        }

        const items = itemsOf(card);
        if (!items.length) entries.push({ card, item: null, status: 'no-magnet' });
        for (const item of items) entries.push({ card, item, status: 'ok' });
      }
      return entries;
    }

    async function fetchPage({ cursor, log }) {
      const page = Number(cursor ?? 1);
      const entries = await readPage(page);
      const accepted = entries.filter((entry) => entry.status !== 'filtered');
      const items = accepted.filter((entry) => entry.item).map((entry) => entry.item);

      if (accepted.length && !items.length) {
        log?.(`${source.name}: pagina ${page} sem nenhum magnet -- template mudou?`);
      }
      return { items, nextCursor: entries.length ? String(page + 1) : null };
    }

    const toItem = (raw) => ({
      sourceId: raw.infohash,
      infohash: raw.infohash,
      name: raw.name,
      sizeBytes: raw.sizeBytes,
      createdUnix: null,
      seeders: raw.seeders ?? null,
      leechers: raw.leechers ?? null,
      language: raw.language ?? null,
    });

    const api = { readPage, fetchPage, toItem };
    return { ...api, ...extend?.(api, http) };
  }

  return { ...source, create };
}

module.exports = { defineHtmlSource };
