import { api, openEvents, token, AuthError } from './lib/api.js';
import { $, attempt, toast, when } from './lib/dom.js';
import { REASONS } from './lib/labels.js';
import { bindDrawer, closeDrawer } from './components/drawer.js';
import { confirmAction } from './components/confirm.js';
import { renderHeader } from './views/header.js';
import { renderOverview } from './views/overview.js';
import { renderTrackers } from './views/trackers.js';
import { openTrackerEditor } from './views/trackerEditor.js';
import { renderSettingsPage, focusSettingsGroup } from './views/settings/index.js';
import { mountLog, appendLog, clearLog } from './views/log.js';

const state = { settings: null, stats: null, job: null, schedule: null, connected: false, page: 'dashboard' };

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
  renderOverview(state, actions);
  renderTrackers(state, actions);
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

// --- routing: #/ is the dashboard, #/configuracoes[/grupo] the settings ---

function route() {
  const [, page, group] = location.hash.match(/^#\/(configuracoes)(?:\/([\w-]+))?/) ?? [];
  state.page = page ? 'settings' : 'dashboard';

  $('#page-dashboard').hidden = state.page !== 'dashboard';
  $('#page-settings').hidden = state.page !== 'settings';
  closeDrawer();
  window.scrollTo({ top: 0 });

  if (state.page === 'settings') {
    showSettings();
    if (group) focusSettingsGroup(group);
  }
  render();
}

// --- dashboard actions ---

const actions = {
  sync: (sources) => attempt(() => api.startJob('sync', { sources })),
  enrich: () => attempt(() => api.startJob('enrich')),
  cancel: () => attempt(() => api.cancelJob()),

  saveSource: (name, patch, message) =>
    attempt(() => api.saveSettings({ sources: { [name]: patch } }).then(applySettings), message),

  editTracker(name) {
    const source = state.settings.sources.find((item) => item.name === name);
    openTrackerEditor(source, {
      indexed: indexedBy(name),
      running: Boolean(state.job.running),
      save: actions.saveSource,
      clear: actions.clearSource,
    });
  },

  async clearSource(name) {
    const ok = await confirmAction({
      title: `Apagar resultados de ${name}?`,
      message:
        `Os ${indexedBy(name).toLocaleString('pt-BR')} torrents deste tracker serão apagados. Não dá para desfazer, ` +
        'mas a próxima atualização do catálogo traz de volta o que ainda estiver no tracker. Capas e notas da TMDB ficam.',
      confirmLabel: 'Apagar resultados',
      requireText: name,
    });
    if (!ok) return;

    const result = await attempt(() => api.clearSource(name));
    if (!result) return;
    toast(`${result.removed.toLocaleString('pt-BR')} torrents de ${name} apagados`);
    closeDrawer();
    await refreshStatus();
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

mountLog();
bindDrawer();
start();
