'use strict';

/**
 * Schemas JSON das rotas. Servem a tres coisas de uma vez: validam a query,
 * serializam a resposta (campo fora do schema nao sai) e viram a pagina do
 * Swagger.
 *
 * A API tem duas entidades, e elas nao se misturam:
 *   obra    -- o filme ou a serie: capa, sinopse, nota. Vem da TMDB.
 *   torrent -- uma copia dela: seeders, tamanho, resolucao. Vem do tracker.
 */

const TAGS = {
  catalogo: 'Catálogo',
  debrid: 'Debrid',
  servico: 'Serviço',
};

const WORK_ORDERS = ['year', 'added', 'rating', 'votes', 'title', 'seeders'];

/** Todo campo e sempre devolvido: o que nao se sabe vai como null, nunca ausente. */
const allRequired = (schema) => ({ ...schema, required: Object.keys(schema.properties) });

// --- a obra ---

/** Todo campo que uma obra pode ter. A listagem usa so um recorte. */
const WORK_FIELDS = {
  id: { type: 'integer', description: 'Id da obra no catálogo.', examples: [362] },
  title: {
    type: 'string',
    description: 'Título como o classificador extraiu do release.',
    examples: ['Interestelar'],
  },
  year: {
    type: ['integer', 'null'],
    description: 'Ano que o classificador leu do nome do release.',
    examples: [2014],
  },
  genres: {
    type: 'array',
    items: { type: 'string' },
    description: 'Gêneros da TMDB, no idioma de `TMDB_LANGUAGE`. Lista vazia quando não há.',
    examples: [['Terror', 'Thriller']],
  },
  poster: {
    type: ['string', 'null'],
    description: 'Capa vertical, URL direta do CDN da TMDB: `w185` na listagem, `w342` no detalhe.',
    examples: ['https://image.tmdb.org/t/p/w185/nBNZadXqJSdt05SHLqgT0HuC5Gm.jpg'],
  },
  backdrop: {
    type: ['string', 'null'],
    description:
      'Imagem horizontal, para fundo e banner: `w780` na listagem, `w1280` no detalhe. ' +
      'Nula com mais frequência que a capa.',
    examples: ['https://image.tmdb.org/t/p/w780/xJHokMbljvjADYdit5fK5VQsXEG.jpg'],
  },
  overview: {
    type: ['string', 'null'],
    description: 'Sinopse, no idioma de `TMDB_LANGUAGE` (pt-BR por padrão).',
  },
  rating: {
    type: ['number', 'null'],
    description:
      'Nota da TMDB, de 0 a 10. **Nula abaixo de `TMDB_MIN_VOTES` votos** (150 por ' +
      'padrão): 8.0 apurado em 4 votos não é nota, é ruído. A mesma regra vale para ordenar.',
    examples: [8.487],
  },
  votes: {
    type: ['integer', 'null'],
    description: 'Quantos votos a TMDB tem. Continua vindo mesmo quando a nota é nula.',
    examples: [41140],
  },
};

/**
 * O que a grade de uma TV precisa para desenhar o cartão e o fundo do item em
 * foco -- nada mais. A sinopse sozinha era metade do peso da listagem.
 */
const CARD_FIELDS = ['id', 'title', 'year', 'poster', 'backdrop', 'rating'];

const pickFields = (keys) => Object.fromEntries(keys.map((key) => [key, WORK_FIELDS[key]]));

const card = ($id, description) =>
  allRequired({ $id, title: $id, description, type: 'object', properties: pickFields(CARD_FIELDS) });

/** A obra aberta: tudo da TMDB, o trailer e as copias -- uma requisicao so. */
const work = ($id, description, torrentRef) =>
  allRequired({
    $id,
    title: $id,
    description,
    type: 'object',
    properties: {
      ...WORK_FIELDS,
      trailer: {
        type: ['string', 'null'],
        description: 'Link do trailer no YouTube, quando a TMDB tem um.',
        examples: ['https://www.youtube.com/watch?v=i6avfCqKcQo'],
      },
      torrents: {
        type: 'array',
        items: { $ref: torrentRef },
        description: 'As cópias desta obra, da mais semeada para a menos. Hoje são de 1 a 3.',
      },
    },
  });

// --- a copia ---

const torrent = ($id, description, extra = {}) =>
  allRequired({
    $id,
    title: $id,
    description,
    type: 'object',
    properties: {
      id: { type: 'integer', examples: [968] },
      name: {
        type: 'string',
        description: 'Nome normalizado pelo classificador.',
        examples: ['Interestelar (2014) 1080p BluRay x264'],
      },
      ...extra,
      seeders: { type: ['integer', 'null'], examples: [112] },
      leechers: { type: ['integer', 'null'], examples: [17] },
      size: {
        type: ['string', 'null'],
        description: 'Tamanho formatado: GB acima de 1 GB, MB abaixo. Base 1024.',
        examples: ['2.39 GB'],
      },
      resolution: { type: ['string', 'null'], examples: ['1080p'] },
      release: {
        type: ['string', 'null'],
        description: 'Fonte do release.',
        examples: ['BluRay'],
      },
      videoCodec: { type: ['string', 'null'], examples: ['x264'] },
      audio: { type: ['string', 'null'], examples: ['DD+ 5.1'] },
      hdr: { type: ['string', 'null'], examples: ['HDR10'] },
      language: {
        type: ['string', 'null'],
        enum: ['dual', 'dubbed', 'subtitled', null],
        description:
          '`dual` (áudio dublado e original), `dubbed` (só dublado) ou `subtitled` (áudio original com legenda). ' +
          'Vem do nome do torrent ou da seção da página do tracker; `null` quando nenhum dos dois diz.',
        examples: ['subtitled'],
      },
      infohash: {
        type: ['string', 'null'],
        description: 'Infohash BitTorrent, para montar o magnet.',
        examples: ['246ce142aa1a42ef3ddc40c96895777b7b327de6'],
      },
      source: { type: 'string', description: 'Tracker de origem.', examples: ['torrents-csv'] },
      cached: {
        type: ['boolean', 'null'],
        description:
          'Se o debrid já tem esta cópia em cache — toca na hora. `null` com o debrid desligado ou quando ' +
          'o provedor não respondeu a tempo. A resposta do provedor fica guardada por 10 minutos.',
        examples: [true],
      },
      createdAt: { type: 'string', format: 'date-time', description: 'Entrada no catálogo.' },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Última vez visto num sync — não é "última vez que mudou".',
      },
    },
  });

const SEASON_EPISODE = {
  season: { type: ['integer', 'null'], description: 'Temporada.', examples: [6] },
  episode: {
    type: ['integer', 'null'],
    description: 'Episódio, quando o release é unitário.',
    examples: [1168],
  },
  seasonEnd: {
    type: ['integer', 'null'],
    description: 'Última temporada de um pacote com várias (`S01-S03`); nulo quando é uma só.',
    examples: [3],
  },
  episodeEnd: {
    type: ['integer', 'null'],
    description: 'Último episódio de uma faixa (`S01E01-E02`); nulo quando é um só.',
    examples: [2],
  },
};

/** Pagina de obras: os itens mais o que o cliente precisa para navegar. */
const page = ($id, ref, key, description) => ({
  $id,
  title: $id,
  description,
  type: 'object',
  properties: {
    [key]: { type: 'array', items: { $ref: ref } },
    page: { type: 'integer', description: 'Página atual.', examples: [1] },
    limit: { type: 'integer', description: 'Itens por página.', examples: [50] },
    total: { type: 'integer', description: 'Total de obras.', examples: [773] },
    pages: { type: 'integer', description: 'Quantas páginas existem.', examples: [16] },
  },
  required: [key, 'page', 'limit', 'total', 'pages'],
});

/** Registrados uma vez no boot e referenciados por `$ref: 'Movie#'`. */
const SHARED = [
  work('Movie', 'Um filme aberto: tudo da TMDB, o trailer e as cópias.', 'MovieTorrent#'),
  work('Series', 'Uma série aberta — a obra inteira, com os episódios como cópias.', 'SeriesTorrent#'),
  card('MovieListItem', 'Um filme na listagem: só o que a grade desenha.'),
  card('SeriesListItem', 'Uma série na listagem: só o que a grade desenha.'),
  torrent('MovieTorrent', 'Uma cópia de um filme.'),
  torrent('SeriesTorrent', 'Uma cópia de uma série: um episódio ou uma temporada.', SEASON_EPISODE),
  page('MovieList', 'MovieListItem#', 'movies', 'Página de filmes.'),
  page('SeriesList', 'SeriesListItem#', 'series', 'Página de séries.'),
  allRequired({
    $id: 'SearchItem',
    title: 'SearchItem',
    description: 'Um resultado da busca: o cartão da grade mais o tipo, para saber qual detalhe abrir.',
    type: 'object',
    properties: {
      ...pickFields(CARD_FIELDS),
      type: { type: 'string', enum: ['movie', 'series'], description: 'Filme ou série.', examples: ['movie'] },
    },
  }),
  page('SearchList', 'SearchItem#', 'results', 'Página de resultados da busca.'),
  {
    $id: 'NotFound',
    title: 'NotFound',
    type: 'object',
    properties: { error: { type: 'string', examples: ['obra nao encontrada'] } },
    required: ['error'],
  },
  {
    $id: 'BadRequest',
    title: 'BadRequest',
    description: 'Query inválida. O corpo é o formato padrão de erro do Fastify.',
    type: 'object',
    properties: {
      statusCode: { type: 'integer', examples: [400] },
      error: { type: 'string', examples: ['Bad Request'] },
      message: {
        type: 'string',
        examples: ['querystring/order must be equal to one of the allowed values'],
      },
    },
  },
];

/** A listagem nao tem filtro: so paginacao. O tipo vem da rota, a ordem e fixa. */
const LIST_QUERY = {
  type: 'object',
  additionalProperties: false,
  properties: {
    page: { type: 'integer', minimum: 1, default: 1, description: 'Página, a partir de 1.' },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 200,
      default: 50,
      description: 'Itens por página.',
    },
    category: {
      type: 'string',
      pattern: '^[a-z0-9-]+$',
      description: 'Id de `/api/categories`. Muda o filtro e a ordem da listagem.',
      examples: ['novidades', 'genero-terror'],
    },
    all: {
      type: 'boolean',
      default: false,
      description:
        'Inclui as obras que não casaram com a TMDB (ou ainda não foram consultadas), no fim da lista: ' +
        'título e ano do torrent, sem capa e sem nota. Sem `TMDB_API_KEY`, é o único jeito de listar algo.',
    },
  },
};

const ID_PARAM = {
  type: 'object',
  properties: { id: { type: 'integer', description: 'Id da obra.' } },
  required: ['id'],
};

/** As duas rotas de um tipo. `kind` e o nome do schema: Movie ou Series. */
const catalogRoutes = (kind, singular, plural) => ({
  list: {
    tags: [TAGS.catalogo],
    summary: `Lista ${plural}`,
    description:
      `Uma linha por ${singular}, não por torrent — os quatro releases de um mesmo ` +
      `filme são um item só. Enxuta de propósito: só o que a grade desenha. ` +
      `Sinopse, gêneros, votos, trailer e as cópias vêm no detalhe.

` +
      'Sem `category`, a ordem é fixa (ano mais recente primeiro e, dentro do ano, ' +
      'a melhor nota) e só entra obra que casou com a TMDB. Com `category`, valem o ' +
      'filtro e a ordem dela.',
    querystring: LIST_QUERY,
    response: { 200: { $ref: `${kind}List#` }, 400: { $ref: 'BadRequest#' } },
  },
  detail: {
    tags: [TAGS.catalogo],
    summary: `Busca ${singular} por id`,
    description:
      'Tudo de uma vez: os dados da TMDB, o trailer e as cópias, da mais semeada para a ' +
      'menos. Ao abrir um item, a TV faz esta requisição e nenhuma outra.\n\n' +
      `Responde 404 quando o id não existe ou quando não é ${singular}.`,
    params: ID_PARAM,
    response: { 200: { $ref: `${kind}#` }, 404: { $ref: 'NotFound#' } },
  },
});

const CATEGORIES = {
  tags: [TAGS.catalogo],
  summary: 'Lista as categorias',
  description:
    'As linhas da tela inicial, montadas a partir do próprio catálogo: as fixas ' +
    '(*Adicionados recentemente*, *Melhores notas*) e uma por gênero com pelo menos ' +
    '10 obras. Categoria vazia não entra.\n\n' +
    'Filmes por padrão; com `type=series`, as categorias das séries, que vêm em `series` ' +
    'em vez de `movies`.\n\n' +
    'Com `preview`, cada categoria já vem com as primeiras obras — a tela inicial ' +
    'inteira em uma requisição. Para paginar, use `/api/movies?category=<id>` ou ' +
    '`/api/series?category=<id>`.',
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      preview: {
        type: 'integer',
        minimum: 0,
        maximum: 30,
        default: 0,
        description: 'Quantas obras já vêm em cada categoria.',
      },
      type: {
        type: 'string',
        enum: ['movie', 'series'],
        default: 'movie',
        description: 'De quem são as categorias: filmes ou séries.',
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        categories: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', examples: ['genero-terror'] },
              title: { type: 'string', examples: ['Terror'] },
              total: { type: 'integer', description: 'Quantas obras a categoria tem.', examples: [42] },
              movies: { type: 'array', items: { $ref: 'MovieListItem#' }, description: 'Com `preview`, sem `type=series`.' },
              series: { type: 'array', items: { $ref: 'SeriesListItem#' }, description: 'Com `preview` e `type=series`.' },
            },
            required: ['id', 'title', 'total'],
          },
        },
      },
      required: ['categories'],
    },
    400: { $ref: 'BadRequest#' },
  },
};

const HEALTH = {
  tags: [TAGS.servico],
  summary: 'Liveness',
  description: 'Responde 200 assim que a API sobe. Não toca no banco. Única rota sem token.',
  security: [],
  response: {
    200: {
      type: 'object',
      properties: { status: { type: 'string', examples: ['ok'] } },
      required: ['status'],
    },
  },
};

const STATS = {
  tags: [TAGS.servico],
  summary: 'Números da instância',
  description:
    'Torrents por tracker e o resultado do match com a TMDB. `pending` são obras que ainda não passaram pela TMDB; ' +
    'com `tmdb.configured` falso, a listagem padrão vem vazia (use `all=true`).',
  response: {
    200: {
      type: 'object',
      properties: {
        sources: {
          type: 'array',
          description: 'Torrents indexados em cada tracker.',
          items: {
            type: 'object',
            properties: {
              source: { type: 'string', examples: ['torrents-csv'] },
              total: { type: 'integer', examples: [995] },
            },
            required: ['source', 'total'],
          },
        },
        works: {
          type: 'array',
          description: 'Obras por resultado do match com a TMDB.',
          items: {
            type: 'object',
            properties: {
              status: { type: 'string', examples: ['ok'] },
              total: { type: 'integer', examples: [805] },
            },
            required: ['status', 'total'],
          },
        },
        tmdb: {
          type: 'object',
          description: 'Se o enriquecimento pode rodar.',
          properties: { configured: { type: 'boolean', examples: [true] } },
          required: ['configured'],
        },
      },
      required: ['sources', 'works', 'tmdb'],
    },
  },
};

const SEARCH = {
  tags: [TAGS.catalogo],
  summary: 'Busca filmes e séries',
  description:
    'Filmes e séries numa lista só. `q` procura no título da TMDB e no do torrent, sem diferenciar ' +
    'acento, maiúscula ou pontuação: `homem aranha` acha *Homem-Aranha*. Cada palavra precisa ' +
    'começar uma palavra do título. Vem primeiro o título que começa com a busca, depois o mais votado.\n\n' +
    '`genre` é um id de `/api/search/genres` e combina com `q`. Sem nenhum dos dois, vêm os mais votados.',
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      q: { type: 'string', maxLength: 80, description: 'O que foi digitado.', examples: ['batman'] },
      genre: {
        type: 'string',
        pattern: '^[a-z0-9-]+$',
        description: 'Id de `/api/search/genres`.',
        examples: ['terror'],
      },
      type: {
        type: 'string',
        enum: ['all', 'movie', 'series'],
        default: 'all',
        description: 'Filmes, séries ou os dois.',
      },
      page: { type: 'integer', minimum: 1, default: 1, description: 'Página, a partir de 1.' },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 30, description: 'Itens por página.' },
      all: {
        type: 'boolean',
        default: false,
        description: 'Inclui as obras que não casaram com a TMDB, como em `/api/movies`.',
      },
    },
  },
  response: { 200: { $ref: 'SearchList#' }, 400: { $ref: 'BadRequest#' }, 404: { $ref: 'NotFound#' } },
};

const SEARCH_GENRES = {
  tags: [TAGS.catalogo],
  summary: 'Atalhos de busca por gênero',
  description:
    'Os gêneros prontos para a tela de busca (*Ação*, *Comédia*, *Terror*…), valendo para filmes e ' +
    'séries. Só vem o que tem ao menos uma obra no catálogo.',
  response: {
    200: {
      type: 'object',
      properties: {
        genres: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', examples: ['terror'] },
              title: { type: 'string', examples: ['Terror'] },
              total: { type: 'integer', description: 'Quantas obras o atalho encontra.', examples: [68] },
            },
            required: ['id', 'title', 'total'],
          },
        },
      },
      required: ['genres'],
    },
  },
};

module.exports = { SHARED, TAGS, HEALTH, STATS, CATEGORIES, SEARCH, SEARCH_GENRES, catalogRoutes };
