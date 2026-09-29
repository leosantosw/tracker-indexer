'use strict';

const { formatDuration } = require('../lib/duration');

const JOB_LABEL = { sync: 'Atualização do catálogo', enrich: 'Busca de capas e notas' };

const REASON_TEXT = {
  'no-tmdb-key': 'sem TMDB_API_KEY: capas e notas não foram buscadas',
  'tmdb-failed': 'a TMDB falhou: capas e notas ficam para a próxima',
};

const count = (n) => n.toLocaleString('pt-BR');
const plural = (n, one, many) => `${count(n)} ${n === 1 ? one : many}`;
const joined = (parts) => parts.filter(Boolean).join(' · ');

function stopText({ stop, stopAfter, pages }) {
  if (stop === 'quiet') return `parou após ${plural(stopAfter, 'página', 'páginas')} sem novidade`;
  if (stop === 'cap') return `limite de ${plural(pages, 'página', 'páginas')} atingido`;
  if (stop === 'loop') return 'o site repetiu uma página';
  if (stop === 'error') return 'parou num erro';
  return null;
}

function describeSourceRun(run, ms) {
  const removed = run.removed.noYear + run.removed.duplicate;
  return joined([
    run.terms && plural(run.terms, 'termo', 'termos'),
    plural(run.pages, 'página', 'páginas'),
    run.inserted ? `+${count(run.inserted)} ${run.inserted === 1 ? 'novo' : 'novos'}` : 'nenhum novo',
    removed && `${plural(removed, 'removido', 'removidos')} pelas regras`,
    !run.terms && stopText(run),
    formatDuration(ms),
  ]);
}

function describeTmdbRun(total, ms) {
  return joined([
    plural(total.seen, 'obra consultada', 'obras consultadas'),
    `${count(total.ok)} ${total.ok === 1 ? 'casada' : 'casadas'}`,
    total.ambiguous && plural(total.ambiguous, 'ambígua', 'ambíguas'),
    total.notFound && `${count(total.notFound)} sem match`,
    total.skipped && plural(total.skipped, 'ignorada', 'ignoradas'),
    total.failed && `${count(total.failed)} com erro`,
    formatDuration(ms),
  ]);
}

function describeStart(job, { sources } = {}) {
  return joined([`${JOB_LABEL[job]} iniciada`, sources?.length && `só ${sources.join(', ')}`]);
}

function outcomeFacts(progress) {
  if (!progress) return [];
  const inserted = progress.sources.reduce((sum, source) => sum + source.inserted, 0);
  const { tmdb } = progress;
  return [
    progress.sources.length > 0 && (inserted ? `+${plural(inserted, 'torrent novo', 'torrents novos')}` : 'nenhum torrent novo'),
    tmdb.state === 'done' && tmdb.ok > 0 && plural(tmdb.ok, 'obra casada', 'obras casadas'),
  ];
}

function describeOutcome({ job, result, reason, error, startedAt, finishedAt, progress }) {
  const label = JOB_LABEL[job];
  const took = formatDuration(new Date(finishedAt) - new Date(startedAt));

  if (result === 'failed') return { level: 'error', message: joined([`${label} falhou após ${took}`, error]) };
  if (result === 'cancelled') return { level: 'warn', message: `${label} cancelada após ${took}` };
  if (result === 'skipped') return { level: 'warn', message: joined([`${label} pulada`, REASON_TEXT[reason]]) };
  return {
    level: reason ? 'warn' : 'info',
    message: joined([`${label} concluída em ${took}`, ...outcomeFacts(progress), REASON_TEXT[reason]]),
  };
}

module.exports = { describeSourceRun, describeTmdbRun, describeStart, describeOutcome };
