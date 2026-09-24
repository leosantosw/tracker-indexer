'use strict';

function cleanPostTitle(title) {
  const upToYear = title.match(/^(.*?\(\d{4}\))/)?.[1] ?? title;
  return upToYear.replace(/\s+Torrent\b/i, '').trim();
}

module.exports = { cleanPostTitle };
