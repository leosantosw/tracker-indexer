'use strict';

const swagger = require('@fastify/swagger');
const swaggerUi = require('@fastify/swagger-ui');

const { version } = require('../../package.json');
const { TAGS } = require('./schemas');

const DESCRIPTION = `
Consulta ao catálogo indexado a partir dos trackers.

O catálogo é dividido por tipo: **filme em \`/movies\`, série em \`/series\`**.
As duas rotas aceitam os mesmos filtros e devolvem o mesmo formato — série
acrescenta \`season\` e \`episode\`, que em filme seriam sempre nulos.

O \`name\` é o título já normalizado pelo classificador; o nome cru do tracker
fica no banco, em \`raw_name\`.

Leitura apenas: não há rota de escrita. O catálogo é alimentado pelo job
(\`npm run sync\`).
`.trim();

/** Swagger em /docs e o JSON em /docs/json. Precisa vir antes das rotas. */
async function registerDocs(app) {
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
        { name: TAGS.servico, description: 'Saúde e números da instância.' },
      ],
    },
    // Sem isto o plugin renomeia todo schema compartilhado para def-0, def-1...
    refResolver: { buildLocalReference: (json, _base, _fragment, i) => json.$id || `def-${i}` },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
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
