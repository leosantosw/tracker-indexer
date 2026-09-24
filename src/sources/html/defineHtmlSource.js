'use strict';

const cheerio = require('cheerio');

const { readMagnet } = require('../../lib/infohash');
const { sizeToBytes } = require('../../lib/size');
const { readFields } = require('./select');

const toCount = (text) => {
  const value = Number(String(text ?? '').replace(/\D/g, ''));
  return text && Number.isFinite(value) ? value : null;
};

/**
 * A card plus one of its magnets becomes an item; without a usable magnet,
 * null. The size comes from the magnet, then from the text around its link
 * ("1080p (2.24 GB)"), then from the card.
 */
function toRaw(card, link, nameOf) {
  const magnet = readMagnet(link.magnet);
  if (!magnet.infohash || !magnet.name) return null;

  return {
    infohash: magnet.infohash,
    name: nameOf({ card, release: magnet.name }),
    sizeBytes: magnet.sizeBytes ?? sizeToBytes(link.context) ?? sizeToBytes(card.size),
    seeders: toCount(card.seeders),
    leechers: toCount(card.leechers),
  };
}

/** Every magnet link of a title page, with the text around it. */
const readMagnets = ($page, selector) =>
  $page(selector)
    .toArray()
    .map((a) => ({ magnet: $page(a).attr('href'), context: $page(a).parent().text() }));

/**
 * Mold for trackers that are an HTML catalog: the tracker declares selectors,
 * the mold does the walking. Known fields: `url`, `title`, `magnet`, `size`,
 * `seeders`, `leechers`; anything else (like `kind`) is there for the hooks.
 *
 *   list    { url(page), rows, fields }  the paginated listing
 *   detail  { fields, magnets? }         optional: read from each title's page;
 *                                        `magnets` is a selector for pages with
 *                                        several (one per quality), each an item
 *   accept  (card) => boolean            optional: which cards enter
 *   nameOf  ({ card, release }) => name  optional: what the classifier reads
 *   extend  (api, http) => overrides     optional: replace fetchPage/toItem
 */
function defineHtmlSource({ list, detail, accept = () => true, nameOf = ({ release }) => release, extend, ...source }) {
  function create(http) {
    async function readCard($row) {
      const card = readFields($row, list.fields);
      if (!detail || !accept(card)) return card;

      const $page = cheerio.load(await http.getText(card.url));
      return {
        ...card,
        ...readFields($page.root(), detail.fields ?? {}),
        ...(detail.magnets && { links: readMagnets($page, detail.magnets) }),
      };
    }

    /**
     * Every row of the page and what became of it: the sync and `check-source`
     * share this. A title with several magnets yields one entry per magnet.
     */
    async function readPage(page) {
      const $ = cheerio.load(await http.getText(list.url(page)));
      const entries = [];

      for (const row of $(list.rows).toArray()) {
        const card = await readCard($(row));
        if (!accept(card)) {
          entries.push({ card, item: null, status: 'filtered' });
          continue;
        }

        const items = (card.links ?? [{ magnet: card.magnet }]).map((link) => toRaw(card, link, nameOf)).filter(Boolean);
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
    });

    const api = { readPage, fetchPage, toItem };
    return { ...api, ...extend?.(api, http) };
  }

  return { ...source, create };
}

module.exports = { defineHtmlSource };
