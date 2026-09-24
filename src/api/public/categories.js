'use strict';

const { CATEGORIES } = require('./schemas');
const { toWorkCard } = require('./dto');

// A genre only becomes a row when the catalog has enough of it.
const MIN_PER_GENRE = 10;

/** Fixed rows, always first, built from columns the catalog already has. */
const FIXED = [
  { id: 'novidades', title: 'Adicionados recentemente', order: 'added' },
  { id: 'melhores', title: 'Melhores notas', order: 'rating' },
];

const slug = (text) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');

/**
 * Categories are saved queries, not a table: the fixed ones plus one per genre
 * that the catalog actually has. They appear and disappear as the catalog grows.
 */
function listCategories(repo, type) {
  const genres = repo
    .genreCounts(type)
    .filter((row) => row.total >= MIN_PER_GENRE)
    .map((row) => ({ id: `genero-${slug(row.genre)}`, title: row.genre, genre: row.genre, order: 'default' }));

  return [...FIXED, ...genres];
}

const findCategory = (repo, type, id) => listCategories(repo, type).find((category) => category.id === id) ?? null;

function registerCategories(app, { repo, store }) {
  const minVotes = () => store.config().tmdb.minVotes;

  app.get('/categories', { schema: CATEGORIES }, async (request) => {
    const preview = request.query.preview ?? 0;
    const votes = minVotes();

    const categories = listCategories(repo, 'movie').map((category) => {
      const { rows, total } = repo.listWorks('movie', {
        limit: Math.max(preview, 1),
        minVotes: votes,
        genre: category.genre ?? null,
        order: category.order,
      });

      return {
        id: category.id,
        title: category.title,
        total,
        ...(preview ? { movies: rows.map((row) => toWorkCard(row, votes)) } : {}),
      };
    });

    return { categories: categories.filter((category) => category.total > 0) };
  });
}

module.exports = { registerCategories, findCategory };
