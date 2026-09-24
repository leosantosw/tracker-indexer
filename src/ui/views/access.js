import { api, token } from '../lib/api.js';
import { $, el, toast } from '../lib/dom.js';
import { randomToken } from '../lib/random.js';
import { copyButton } from '../components/copyButton.js';

const MODES = {
  login: {
    title: 'Acesso ao painel',
    message: '',
    submit: 'Entrar',
    autocomplete: 'current-password',
  },
  setup: {
    title: 'Crie o token do painel',
    message: 'Primeiro acesso: defina o ADMIN_TOKEN. Depois disso, o painel só abre com ele. Guarde-o num lugar seguro.',
    submit: 'Criar e entrar',
    autocomplete: 'new-password',
  },
  remote: {
    title: 'Painel sem token',
    message: 'Nenhum ADMIN_TOKEN foi criado ainda. Abra o painel em localhost, na máquina do servidor, para criar.',
  },
};

async function modeOf(error) {
  if (error.tokenRequired) return 'login';
  const { required, allowed } = await api.setupStatus();
  if (!required) return 'login';
  return allowed ? 'setup' : 'remote';
}

function tokenInput(mode) {
  return el('input', {
    type: mode === 'setup' ? 'text' : 'password',
    name: 'token',
    class: 'input',
    required: true,
    autocomplete: MODES[mode].autocomplete,
    spellcheck: 'false',
  });
}

function generateButton(input) {
  return el(
    'button',
    {
      type: 'button',
      class: 'btn btn-secondary shrink-0',
      onclick: () => {
        input.value = randomToken();
        input.select();
      },
    },
    'Gerar'
  );
}

function setupControls(input) {
  return el('div', { class: 'space-y-2' }, input, el('div', { class: 'flex gap-2' }, generateButton(input), copyButton(input)));
}

async function submit(mode, value) {
  if (mode === 'setup') await api.createAdminToken(value);
  token.set(value);
}

function render(dialog, mode, onReady) {
  const { title, message, submit: label } = MODES[mode];
  const input = label ? tokenInput(mode) : null;

  const form = el(
    'form',
    {
      method: 'dialog',
      class: 'space-y-4 p-6',
      onsubmit: async (event) => {
        event.preventDefault();
        try {
          await submit(mode, input.value.trim());
          dialog.close();
          onReady();
        } catch (err) {
          toast(err.message, 'error');
        }
      },
    },
    el('div', {}, el('h2', { class: 'text-base font-semibold' }, title), message && el('p', { class: 'mt-1 text-sm text-zinc-500' }, message)),
    input &&
      el(
        'label',
        { class: 'block space-y-1.5' },
        el('span', { class: 'label' }, 'ADMIN_TOKEN'),
        mode === 'setup' ? setupControls(input) : input
      ),
    label && el('div', { class: 'flex justify-end' }, el('button', { class: 'btn btn-primary' }, label))
  );

  dialog.replaceChildren(form);
}

export async function askForAccess(error, onReady) {
  const dialog = $('#auth-dialog');
  try {
    render(dialog, await modeOf(error), onReady);
  } catch (err) {
    toast(err.message, 'error');
    return;
  }
  if (!dialog.open) dialog.showModal();
}
