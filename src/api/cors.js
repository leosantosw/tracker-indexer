'use strict';

const cors = require('@fastify/cors');

/**
 * CORS for the routes apps call from another origin: the TV app runs from
 * file:// (origin "null") and the desktop dev server from localhost. No
 * cookies are involved -- auth is a Bearer header -- so any origin is fine.
 * The admin API does not get this: the panel is served by this same server.
 */
const allowApps = (api) =>
  api.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 600,
  });

module.exports = { allowApps };
