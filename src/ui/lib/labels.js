// Friendly names for the jobs. The API, CLI and log keep `sync` and `enrich`.
export const JOBS = {
  sync: {
    action: 'Atualizar catálogo',
    running: 'atualizando catálogo',
    title: 'Atualização do catálogo',
    hint: 'Busca torrents novos nos trackers ativos e depois capas e notas na TMDB',
  },
  enrich: {
    action: 'Buscar capas e notas',
    running: 'buscando capas e notas',
    title: 'Busca de capas e notas',
    hint: 'Consulta a TMDB só para as obras novas ou com nota vencida, sem tocar nos trackers',
  },
};

export const CONTENT = {
  movies: { label: 'Buscar apenas filmes', short: 'filmes' },
  series: { label: 'Buscar apenas séries', short: 'séries' },
  both: { label: 'Buscar filmes e séries', short: 'filmes e séries' },
};

export const SOURCE_SYNC = {
  action: 'Buscar torrents',
  hint: (name) => `Busca torrents novos só no ${name} e depois capas e notas`,
};

// Both titles are feminine: "atualização", "busca".
export const RESULTS = {
  done: ['concluída', 'emerald'],
  skipped: ['pulada', 'amber'],
  cancelled: ['cancelada', 'amber'],
  failed: ['falhou', 'rose'],
};

/** Codes a job leaves in `last.reason`. `fix` names the settings shortcut, if any. */
export const REASONS = {
  'no-tmdb-key': {
    text: 'Capas e notas não foram buscadas: falta a TMDB_API_KEY.',
    fix: 'Cadastrar chave',
  },
  'tmdb-failed': {
    text: 'A TMDB falhou: capas e notas ficam para a próxima. Detalhes no log.',
  },
};
