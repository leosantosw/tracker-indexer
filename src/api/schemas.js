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
  servico: 'Serviço',
};

const WORK_ORDERS = ['year', 'added', 'rating', 'votes', 'title', 'seeders'];

/** Todo campo e sempre devolvido: o que nao se sabe vai como null, nunca ausente. */
const allRequired = (schema) => ({ ...schema, required: Object.keys(schema.properties) });

// --- a obra ---

/**
 * A listagem e o detalhe nao carregam a mesma coisa: trailer e contagem de
 * copias so fazem sentido na obra aberta, nao repetidos em cada linha.
 */
const DETALHE = {
  trailer: {
    type: ['string', 'null'],
    description: 'Link do trailer no YouTube, quando a TMDB tem um.',
    examples: ['https://www.youtube.com/watch?v=i6avfCqKcQo'],
  },
  torrents: {
    type: 'integer',
    description: 'Quantas cópias desta obra existem no catálogo.',
    examples: [3],
  },
  bestSeeders: {
    type: ['integer', 'null'],
    description: 'Seeders da melhor cópia.',
    examples: [112],
  },
};

const work = ($id, description, extra = {}) =>
  allRequired({
    $id,
    title: $id,
    description,
    type: 'object',
    properties: {
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
        description: 'Capa vertical, para a grade. URL direta do CDN da TMDB.',
        examples: ['https://image.tmdb.org/t/p/w342/nBNZadXqJSdt05SHLqgT0HuC5Gm.jpg'],
      },
      backdrop: {
        type: ['string', 'null'],
        description:
          'Imagem horizontal, para banner e fundo. Nula com mais frequência que a capa.',
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
          'padrão): 8.0 apurado em 4 votos não é nota, é ruído. A mesma regra vale para ' +
          'ordenar e para o filtro `minRating`.',
        examples: [8.487],
      },
      votes: {
        type: ['integer', 'null'],
        description: 'Quantos votos a TMDB tem. Continua vindo mesmo quando a nota é nula.',
        examples: [41140],
      },
      ...extra,
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
      infohash: {
        type: ['string', 'null'],
        description: 'Infohash BitTorrent, para montar o magnet.',
        examples: ['246ce142aa1a42ef3ddc40c96895777b7b327de6'],
      },
      source: { type: 'string', description: 'Tracker de origem.', examples: ['torrents-csv'] },
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

/** Lista simples, sem paginacao: as copias de uma obra sao poucas. */
const list = ($id, ref, key, description) => ({
  $id,
  title: $id,
  description,
  type: 'object',
  properties: { [key]: { type: 'array', items: { $ref: ref } } },
  required: [key],
});

/** Registrados uma vez no boot e referenciados por `$ref: 'Movie#'`. */
const SHARED = [
  work('Movie', 'Um filme aberto: traz trailer e os números das cópias.', DETALHE),
  work('Series', 'Uma série aberta — a obra inteira, não um episódio.', DETALHE),
  work('MovieListItem', 'Um filme na listagem.'),
  work('SeriesListItem', 'Uma série na listagem.'),
  torrent('MovieTorrent', 'Uma cópia de um filme.'),
  torrent('SeriesTorrent', 'Uma cópia de uma série: um episódio ou uma temporada.', SEASON_EPISODE),
  page('MovieList', 'MovieListItem#', 'movies', 'Página de filmes.'),
  page('SeriesList', 'SeriesListItem#', 'series', 'Página de séries.'),
  list('MovieTorrentList', 'MovieTorrent#', 'torrents', 'Cópias de um filme.'),
  list('SeriesTorrentList', 'SeriesTorrent#', 'torrents', 'Cópias de uma série.'),
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
  },
};

const ID_PARAM = {
  type: 'object',
  properties: { id: { type: 'integer', description: 'Id da obra.' } },
  required: ['id'],
};

/** As tres rotas de um tipo. `kind` e o nome do schema: Movie ou Series. */
const catalogRoutes = (kind, singular, plural) => ({
  list: {
    tags: [TAGS.catalogo],
    summary: `Lista ${plural}`,
    description:
      `Uma linha por ${singular}, não por torrent — os quatro releases de um mesmo ` +
      `filme são um item só. Trailer e contagem de cópias só no detalhe; ` +
      `as cópias em si, em \`{id}/torrents\`.

` +
      'Sem filtros: a ordem é fixa (ano mais recente primeiro e, dentro do ano, ' +
      'a melhor nota) e só entra obra que casou com a TMDB.',
    querystring: LIST_QUERY,
    response: { 200: { $ref: `${kind}List#` }, 400: { $ref: 'BadRequest#' } },
  },
  detail: {
    tags: [TAGS.catalogo],
    summary: `Busca ${singular} por id`,
    description:
      `Responde 404 quando o id não existe, quando não é ${singular} ou quando a obra ` +
      `ficou sem nenhuma cópia no catálogo.`,
    params: ID_PARAM,
    response: { 200: { $ref: `${kind}#` }, 404: { $ref: 'NotFound#' } },
  },
  torrents: {
    tags: [TAGS.catalogo],
    summary: `Cópias ${singular === 'um filme' ? 'do filme' : 'da série'}`,
    description:
      'Os torrents desta obra, do mais semeado para o menos. Aqui moram seeders, ' +
      'tamanho, resolução e infohash — nada disso pertence à obra, e sim à cópia.',
    params: ID_PARAM,
    response: { 200: { $ref: `${kind}TorrentList#` }, 404: { $ref: 'NotFound#' } },
  },
});

const HEALTH = {
  tags: [TAGS.servico],
  summary: 'Liveness',
  description: 'Responde 200 assim que a API sobe. Não toca no banco.',
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
  description: 'Torrents por tracker e o resultado do match com a TMDB.',
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
      },
      required: ['sources', 'works'],
    },
  },
};

module.exports = { SHARED, TAGS, HEALTH, STATS, catalogRoutes };
