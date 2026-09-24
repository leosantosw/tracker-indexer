'use strict';

const UNITS = { KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 };

/** "2.69 GB" or "1,5 GB" -> bytes; null when it is not a size. */
function sizeToBytes(text) {
  const match = String(text ?? '').match(/([\d.,]+)\s*(KB|MB|GB|TB)/i);
  if (!match) return null;

  const value = Number(match[1].replace(',', '.'));
  return Number.isFinite(value) ? Math.round(value * UNITS[match[2].toUpperCase()]) : null;
}

module.exports = { sizeToBytes };
