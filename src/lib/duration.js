'use strict';

function formatDuration(ms) {
  const seconds = ms / 1000;
  if (seconds < 10) return `${seconds.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}s`;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}m${String(whole % 60).padStart(2, '0')}s`;
}

module.exports = { formatDuration };
