'use strict';

const { TAGS } = require('../public/schemas');

// Hex (40) or base32 (32): the two forms an infohash shows up in.
const HASH = {
  type: 'string',
  pattern: '^([0-9a-fA-F]{40}|[A-Za-z2-7]{32})$',
  description: 'Infohash do torrent — o `infohash` que vem em cada cópia do detalhe.',
  examples: ['ac3ee9395349ad9a0b6ef13e1520511a6b9ee2b2'],
};

const STATUS = {
  type: 'object',
  description:
    '`ready` e `failed` são definitivos; `downloading` e `queued` pedem para consultar de novo. ' +
    'Só `ready` traz `url`, e ela é gerada na hora: **expira, não guarde**.',
  properties: {
    status: { type: 'string', enum: ['ready', 'downloading', 'queued', 'failed'] },
    url: { type: 'string', description: 'Link direto do vídeo no CDN do provedor. Só em `ready`.' },
    file: {
      type: 'object',
      properties: { name: { type: 'string' }, size: { type: ['integer', 'null'] } },
    },
    progress: { type: 'integer', description: 'Porcentagem, 0 a 100. Só em `downloading`.' },
    eta: { type: ['integer', 'null'], description: 'Segundos até terminar, quando o provedor sabe.' },
    state: { type: ['string', 'null'], description: 'Estado cru do provedor, para diagnóstico.' },
    reason: { type: 'string', description: 'Em `failed`: `no_video` ou `provider_failed`.' },
    cached: { type: 'boolean', description: 'Só no POST de um torrent novo: se o provedor já o tinha.' },
  },
  required: ['status'],
};

const ERROR = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    code: {
      type: 'string',
      description:
        '`not_configured`, `missing_token`, `not_found`, `provider_auth`, `provider_rate_limit`, ' +
        '`provider_error` ou `provider_unavailable`.',
    },
  },
};

const common = {
  tags: [TAGS.debrid],
  security: [{ bearerAuth: [] }],
};

const HASH_PARAM = { type: 'object', properties: { hash: HASH }, required: ['hash'] };

const errors = { 401: ERROR, 404: ERROR, 429: ERROR, 502: ERROR, 503: ERROR, 504: ERROR };

const RESOLVE = {
  ...common,
  summary: 'Pede o vídeo de um torrent',
  description:
    'Se o provedor já tem o torrent em cache, responde **200 `ready`** com o link. Se não, manda ' +
    'baixar e responde **202 `downloading`** (ou `queued`, com todas as vagas ocupadas).\n\n' +
    'Pode chamar de novo sem medo: um torrent que já está na conta não é adicionado outra vez. ' +
    'Para acompanhar o download, prefira o `GET`, que nunca adiciona nada.',
  body: { type: 'object', properties: { hash: HASH }, required: ['hash'], additionalProperties: false },
  response: { 200: STATUS, 202: STATUS, 400: ERROR, ...errors },
};

const STATUS_ROUTE = {
  ...common,
  summary: 'Consulta o status de um torrent',
  description:
    'Só leitura. A TV consulta a cada ~5 s depois do `POST`, até vir `ready` ou `failed`. ' +
    'Em `ready`, cada chamada gera um link novo.',
  params: HASH_PARAM,
  response: { 200: STATUS, 400: ERROR, ...errors },
};

const REMOVE = {
  ...common,
  summary: 'Cancela o download ou remove o torrent do provedor',
  params: HASH_PARAM,
  response: {
    200: { type: 'object', properties: { removed: { type: 'boolean' } }, required: ['removed'] },
    400: ERROR,
    ...errors,
  },
};

module.exports = { RESOLVE, STATUS_ROUTE, REMOVE };
