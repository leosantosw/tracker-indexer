'use strict';

const { UNMATCHED } = require('../schemas');

function registerUnmatchedRoutes(api, { repo }) {
  api.get('/unmatched', { schema: UNMATCHED }, async (request) => {
    const { source = null, status = null, page, limit } = request.query;
    return { ...repo.listUnmatched({ source, status, page, limit }), page, limit, counts: repo.unmatchedCounts() };
  });
}

module.exports = { registerUnmatchedRoutes };
