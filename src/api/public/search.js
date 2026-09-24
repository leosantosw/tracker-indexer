'use strict';

const { SEARCH, SEARCH_GENRES } = require('./schemas');
const { toWorkCard } = require('./dto');

/**
 * Ready-made searches for the TV keyboard. TMDB names TV genres differently
 * ("Action & Adventure"), so one shortcut can stand for several genres.
 */
const SHORTCUTS = [
  { id: 'acao', title: 'Ação', genres: ['Ação', 'Action & Adventure'] },
  { id: 'comedia', title: 'Comédia', genres: ['Comédia'] },
  { id: 'terror', title: 'Terror', genres: ['Terror'] },
  { id: 'romance', title: 'Romance', genres: ['Romance'] },
  { id: 'suspense', title: 'Suspense', genres: ['Thriller', 'Mistério'] },
  { id: 'drama', title: 'Drama', genres: ['Drama'] },
  { id: 'ficcao', title: 'Ficção científica', genres: ['Ficção científica', 'Sci-Fi & Fantasy'] },
  { id: 'animacao', title: 'Animação', genres: ['Animação'] },
  { id: 'aventura', title: 'Aventura', genres: ['Aventura', 'Action & Adventure'] },
  { id: 'crime', title: 'Crime', genres: ['Crime'] },
  { id: 'familia', title: 'Família', genres: ['Família', 'Kids'] },
  { id: 'documentario', title: 'Documentário', genres: ['Documentário'] },
];

const shortcutOf = (id) => SHORTCUTS.find((shortcut) => shortcut.id === id) ?? null;

function registerSearch(app, { repo, store }) {
  const minVotes = () => store.config().tmdb.minVotes;

  app.get('/search', { schema: SEARCH }, async (request, reply) => {
    const { q = '', genre, type = 'all', page, limit, all } = request.query;
    const shortcut = genre ? shortcutOf(genre) : null;
    if (genre && !shortcut) return reply.code(404).send({ error: 'genero nao encontrado' });

    const votes = minVotes();
    const { rows, total } = repo.searchWorks({
      query: q,
      genres: shortcut?.genres ?? [],
      type: type === 'all' ? null : type,
      page,
      limit,
      all,
    });

    return {
      results: rows.map((row) => ({ ...toWorkCard(row, votes), type: row.type })),
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    };
  });

  app.get('/search/genres', { schema: SEARCH_GENRES }, async () => {
    const genres = SHORTCUTS.map(({ id, title, genres: names }) => ({
      id,
      title,
      total: repo.searchWorks({ genres: names, limit: 1 }).total,
    }));
    return { genres: genres.filter((genre) => genre.total > 0) };
  });
}

module.exports = { registerSearch };
