import { api, openEvents, token, AuthError } from './lib/api.js';
import { $, attempt, toast, when } from './lib/dom.js';
import { REASONS } from './lib/labels.js';
import { confirmAction } from './components/confirm.js';
import { renderHeader } from './views/header.js';
import { renderOverview } from './views/overview.js';
import { renderAlerts } from './views/alerts.js';
import { renderTrackers } from './views/trackers.js';
import { renderTrackerPage } from './views/trackerPage.js';
import { openCheckDialog } from './views/checkDialog.js';
import { renderSettingsPage, focusSettingsGroup } from './views/settings/index.js';
import { appendLog, clearLog } from './views/log.js';
import { mountActivity, renderActivity } from './views/activity.js';

const state = { settings: null, stats: null, job: null, schedule: null, connected: false, page: 'dashboard', tracker: null };

const indexedBy = (name) => state.stats.sources.find((row) => row.source === name)?.total ?? 0;
let events = null;

/**
 * Live parts only. The settings page is not redrawn here: a job update every
 * second would wipe what is being typed. It redraws on open and after a save.
 */
function render() {
  if (!state.settings || !state.stats || !state.job) return;
  const hasEnabled = state.settings.sources.some((source) => source.enabled);
  const hasTmdbKey = Boolean(state.settings.secrets.tmdbApiKey.source);

  renderHeader({ ...state, hasEnabled, hasTmdbKey }, actions);
  renderAlerts(state, actions);
  renderOverview(state, actions);
  renderTrackers(state, actions);
  renderActivity(state);
}

async function refreshStatus() {
  const { job, stats, schedule } = await api.status();
  Object.assign(state, { job, stats, schedule });
  render();
}

function applySettings(settings) {
  state.settings = settings;
  render();
  return settings;
}

/** A job that just finished changed the catalog: fetch fresh numbers. */
function onJob(job) {
  const finished = state.job?.running && !job.running;
  state.job = job;
  render();
  if (!finished) return;

  refreshStatus().catch((err) => toast(err.message, 'error'));
  const reason = REASONS[job.last?.reason];
  if (reason) toast(reason.text, 'warn');
}

// --- settings page ---

const settingsActions = {
  /** Saved: back to the dashboard. On error, stays on the page with what was typed. */
  save: (patch) =>
    attempt(async () => {
      applySettings(await api.saveSettings(patch));
      if (patch.secrets?.adminToken) adoptToken(patch.secrets.adminToken);
      location.hash = '#/';
    }, 'Configurações salvas'),

  async removeSecret(name) {
    const ok = await confirmAction({
      title: 'Remover segredo do painel?',
      message: 'O valor salvo aqui é apagado. Se houver um no .env, ele volta a valer.',
      confirmLabel: 'Remover',
    });
    if (!ok) return;
    const done = await attempt(() => api.saveSettings({ secrets: { [name]: null } }).then(applySettings), 'Segredo removido');
    if (done) showSettings();
  },

  async reset() {
    const done = await attempt(() => api.resetSettings().then(applySettings), 'Padrões restaurados');
    if (done) showSettings();
  },
};

function showSettings() {
  const nextRun = state.schedule?.nextRunAt ? when(state.schedule.nextRunAt) : null;
  if (state.settings) renderSettingsPage($('#page-settings'), state.settings, settingsActions, { nextRun });
}

// --- tracker page ---

const findSource = (name) => state.settings?.sources.find((source) => source.name === name) ?? null;

function showTracker(name) {
  const source = findSource(name);
  if (!source) return false;
  renderTrackerPage($('#page-tracker'), source, {
    indexed: indexedBy(name),
    running: Boolean(state.job?.running),
    save: (sourceName, patch) =>
      actions.saveSource(sourceName, patch, `${sourceName} salvo`).then((ok) => ok && (location.hash = '#/')),
    sync: actions.sync,
    check: actions.checkSource,
    clear: actions.clearSource,
  });
  return true;
}

// --- routing: #/ is the dashboard, #/configuracoes[/grupo] the settings, #/trackers/<nome> one tracker ---

const PAGES = ['dashboard', 'settings', 'tracker'];

function route() {
  const settings = location.hash.match(/^#\/configuracoes(?:\/([\w-]+))?/);
  const [, tracker] = location.hash.match(/^#\/trackers\/([^/]+)/) ?? [];
  const settingsGroup = settings?.[1];

  state.page = settings ? 'settings' : tracker ? 'tracker' : 'dashboard';
  state.tracker = tracker ? decodeURIComponent(tracker) : null;

  if (state.page === 'tracker' && state.settings && !findSource(state.tracker)) {
    toast(`tracker desconhecido: ${state.tracker}`, 'error');
    location.hash = '#/';
    return;
  }

  for (const page of PAGES) $(`#page-${page}`).hidden = state.page !== page;
  window.scrollTo({ top: 0 });

  if (state.page === 'settings') {
    showSettings();
    if (settingsGroup) focusSettingsGroup(settingsGroup);
  }
  if (state.page === 'tracker') showTracker(state.tracker);
  render();
}

// --- dashboard actions ---

const actions = {
  sync: (sources) => attempt(() => api.startJob('sync', { sources })),
  enrich: () => attempt(() => api.startJob('enrich')),
  cancel: () => attempt(() => api.cancelJob()),

  checkSource: (name) => openCheckDialog(name, api.checkSource),

  saveSource: (name, patch, message) =>
    attempt(() => api.saveSettings({ sources: { [name]: patch } }).then(applySettings), message),

  async clearSource(name) {
    const ok = await confirmAction({
      title: `Tem certeza que quer apagar os torrents de ${name}?`,
      confirmLabel: 'Apagar',
    });
    if (!ok) return;

    const result = await attempt(() => api.clearSource(name));
    if (!result) return;
    toast(`${result.removed.toLocaleString('pt-BR')} torrents de ${name} apagados`);
    await refreshStatus();
    if (state.page === 'tracker') showTracker(name);
  },

  /** Used by shortcuts like "Cadastrar chave": opens the page on the TMDB key. */
  openSettings() {
    location.hash = '#/configuracoes/tmdb';
  },

  openSchedule() {
    location.hash = '#/configuracoes/agendamento';
  },
};

// --- session ---

function askForAccess(error) {
  $('#auth-message').textContent = error.tokenRequired ? '' : error.message;
  $('#auth-message').hidden = error.tokenRequired;
  $('#auth-token-field').hidden = !error.tokenRequired;
  $('#auth-form button').hidden = !error.tokenRequired;
  $('#auth-dialog').showModal();
}

/** The token was just changed here: keep this browser signed in with it. */
function adoptToken(value) {
  token.set(value);
  connectEvents();
}

function connectEvents() {
  events?.close();
  events = openEvents({
    onOpen: () => {
      clearLog();
      setConnected(true);
    },
    onError: () => setConnected(false),
    onStatus: onJob,
    onSchedule: (schedule) => {
      state.schedule = schedule;
      render();
    },
    onLog: appendLog,
  });
}

function setConnected(connected) {
  state.connected = connected;
  render();
}

async function start() {
  try {
    const [settings] = await Promise.all([api.settings(), refreshStatus()]);
    applySettings(settings);
    route();
    connectEvents();
  } catch (err) {
    if (err instanceof AuthError) return askForAccess(err);
    toast(err.message, 'error');
  }
}

$('#auth-form').addEventListener('submit', (event) => {
  token.set(new FormData(event.target).get('token'));
  start();
});

window.addEventListener('hashchange', route);

mountActivity();
start();
