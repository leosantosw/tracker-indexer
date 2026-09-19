'use strict';

const swagger = require('@fastify/swagger');
const swaggerUi = require('@fastify/swagger-ui');

const { version } = require('../../../package.json');
const { TAGS } = require('./schemas');

const DESCRIPTION = `
Consulta ao catálogo indexado a partir dos trackers.

O catálogo é dividido por tipo: **filme em \`/api/movies\`, série em \`/api/series\`**.
As duas rotas aceitam os mesmos filtros e devolvem o mesmo formato — série
acrescenta \`season\` e \`episode\`, que em filme seriam sempre nulos.

O \`name\` é o título já normalizado pelo classificador; o nome cru do tracker
fica no banco, em \`raw_name\`.

O catálogo é só leitura, alimentado pelo job (\`npm run sync\`).

As rotas de **Debrid** entregam o vídeo pelo provedor configurado no painel
(hoje, TorBox). Elas exigem \`Authorization: Bearer <API_TOKEN>\`; sem
\`API_TOKEN\` definido, só respondem para localhost.
`.trim();

/** Swagger UI at `routePrefix`, JSON at `routePrefix`/json. Must come before the routes. */
async function registerDocs(app, routePrefix) {
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'tracker-indexer',
        description: DESCRIPTION,
        version,
      },
      tags: [
        { name: TAGS.catalogo, description: 'Filmes e séries indexados.' },
        { name: TAGS.debrid, description: 'Vídeo pronto para tocar, pelo provedor de debrid.' },
        { name: TAGS.servico, description: 'Saúde e números da instância.' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', description: 'O API_TOKEN definido no painel ou no .env.' },
        },
      },
    },
    // Sem isto o plugin renomeia todo schema compartilhado para def-0, def-1...
    refResolver: { buildLocalReference: (json, _base, _fragment, i) => json.$id || `def-${i}` },
  });

  await app.register(swaggerUi, {
    routePrefix,
    staticCSP: true,
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      tryItOutEnabled: true,
      defaultModelsExpandDepth: 2,
    },
  });
}

module.exports = { registerDocs };
