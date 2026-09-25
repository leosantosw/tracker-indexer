'use strict';

const { PROVIDERS, PROVIDER_IDS } = require('../../debrid');
const { CONTENT_IDS } = require('../../sources/content');

/** Admin routes stay out of the public Swagger: they drive the job, not the catalog. */
const hidden = (schema) => ({ hide: true, ...schema });

const positiveInt = { type: 'integer', minimum: 1 };
const optionalPositiveInt = { type: ['integer', 'null'], minimum: 1 };
const rps = { type: 'number', exclusiveMinimum: 0, maximum: 50 };

/** A string sets the secret, null removes the panel value. No whitespace. */
const secret = (minLength, maxLength) => ({ type: ['string', 'null'], minLength, maxLength, pattern: '^\\S+$' });

const SOURCE_PATCH = {
  type: 'object',
  additionalProperties: false,
  properties: {
    enabled: { type: 'boolean' },
    rps,
    pages: optionalPositiveInt,
    stopAfterQuietPages: optionalPositiveInt,
    content: { enum: CONTENT_IDS },
    terms: {
      type: 'array',
      minItems: 1,
      uniqueItems: true,
      items: { type: 'string', minLength: 3 },
    },
    rules: {
      type: 'object',
      additionalProperties: false,
      properties: {
        requireYear: { type: 'boolean' },
        dedupe: { enum: [null, 'seeders'] },
      },
    },
  },
};

const SETTINGS_PATCH = hidden({
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      tmdb: {
        type: 'object',
        additionalProperties: false,
        properties: {
          language: { type: 'string', pattern: '^[a-z]{2}(-[A-Z]{2})?$' },
          rps,
          staleDays: positiveInt,
          minVotes: { type: 'integer', minimum: 0 },
        },
      },
      sources: { type: 'object', additionalProperties: SOURCE_PATCH },
      debrid: {
        type: 'object',
        additionalProperties: false,
        properties: { provider: { enum: [null, ...PROVIDER_IDS] } },
      },
      schedule: {
        type: 'object',
        additionalProperties: false,
        properties: {
          enabled: { type: 'boolean' },
          mode: { enum: ['daily', 'interval'] },
          time: { type: 'string', pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$' },
          days: {
            type: 'array',
            minItems: 1,
            uniqueItems: true,
            items: { type: 'integer', minimum: 0, maximum: 6 },
          },
          // One minute up to one week.
          everyMinutes: { type: 'integer', minimum: 1, maximum: 10080 },
        },
      },
      secrets: {
        type: 'object',
        additionalProperties: false,
        properties: {
          tmdbApiKey: secret(16, 512),
          adminToken: secret(1, 256),
          apiToken: secret(1, 256),
          ...Object.fromEntries(PROVIDERS.map(({ secret: name }) => [name, secret(8, 512)])),
        },
      },
    },
  },
});

const START_JOB = hidden({
  params: {
    type: 'object',
    properties: { job: { type: 'string', enum: ['sync', 'enrich'] } },
    required: ['job'],
  },
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      sources: { type: 'array', items: { type: 'string' }, uniqueItems: true },
    },
  },
});

const CLEAR_SOURCE = hidden({
  params: {
    type: 'object',
    properties: { name: { type: 'string', minLength: 1 } },
    required: ['name'],
  },
});

const UNMATCHED = hidden({
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      source: { type: 'string', minLength: 1 },
      status: { enum: ['not_found', 'ambiguous'] },
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      token: { type: 'string' },
    },
  },
});

const TMDB_SEARCH = hidden({
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      type: { enum: ['movie', 'series'] },
      query: { type: 'string', minLength: 1, maxLength: 200 },
      token: { type: 'string' },
    },
    required: ['type', 'query'],
  },
});

const MANUAL_MATCH = hidden({
  params: {
    type: 'object',
    properties: { id: { type: 'integer', minimum: 1 } },
    required: ['id'],
  },
  body: {
    type: 'object',
    additionalProperties: false,
    properties: { tmdbId: { type: 'integer', minimum: 1 } },
    required: ['tmdbId'],
  },
});

const SETUP_STATUS = hidden({});

const SETUP = hidden({
  body: {
    type: 'object',
    additionalProperties: false,
    properties: { token: { type: 'string', minLength: 1, maxLength: 256, pattern: '^\\S+$' } },
    required: ['token'],
  },
});

const EVENTS = hidden({
  querystring: { type: 'object', properties: { token: { type: 'string' } } },
});

module.exports = { hidden, SETTINGS_PATCH, START_JOB, CLEAR_SOURCE, UNMATCHED, TMDB_SEARCH, MANUAL_MATCH, SETUP_STATUS, SETUP, EVENTS };
