'use strict';

const LEVELS = ['debug', 'info', 'warn', 'error'];

const LABELS = { debug: 'DEBUG', info: 'INFO', warn: 'AVISO', error: 'ERRO' };

const COLORS = { debug: '\x1b[90m', info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m' };
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const SCOPE_WIDTH = 16;
const LEVEL_WIDTH = 5;

const atLeast = (level, min) => LEVELS.indexOf(level) >= LEVELS.indexOf(min);

function createLogger(sink = () => {}, { now = () => new Date() } = {}) {
  const emit = (level) => (scope, message) => sink({ at: now().toISOString(), level, scope, message });
  return Object.fromEntries(LEVELS.map((level) => [level, emit(level)]));
}

const silentLogger = createLogger();

function fitScope(scope) {
  if (scope.length <= SCOPE_WIDTH) return scope.padEnd(SCOPE_WIDTH);
  return `${scope.slice(0, SCOPE_WIDTH - 1)}…`;
}

const clock = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour12: false });

function formatEntry({ at, level, scope, message }, { color = false } = {}) {
  const label = LABELS[level].padEnd(LEVEL_WIDTH);
  if (!color) return `${clock(at)}  ${label}  ${fitScope(scope)}  ${message}`;
  return `${DIM}${clock(at)}${RESET}  ${COLORS[level]}${label}${RESET}  ${DIM}${fitScope(scope)}${RESET}  ${message}`;
}

function consoleSink({ minLevel = 'info', color = Boolean(process.stdout.isTTY) } = {}) {
  return (entry) => {
    if (!atLeast(entry.level, minLevel)) return;
    const write = entry.level === 'error' ? console.error : console.log;
    write(formatEntry(entry, { color }));
  };
}

module.exports = { LEVELS, createLogger, silentLogger, formatEntry, consoleSink };
