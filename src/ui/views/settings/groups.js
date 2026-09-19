import { el } from '../../lib/dom.js';
import { field, numberInput } from '../../components/controls.js';
import { secretField } from '../../components/secretField.js';
import { group, twoColumns } from './layout.js';

export const SECTIONS = {
  schedule: {
    id: 'agendamento',
    title: 'Agendamento',
    description: 'Quando o catálogo se atualiza sozinho: primeiro os torrents, depois capas e notas.',
  },
  tmdb: {
    id: 'tmdb',
    title: 'TMDB',
    description:
      'Capas, sinopses e notas. A chave e os votos mínimos valem na hora; idioma e ritmo, na próxima execução.',
  },
  debrid: {
    id: 'debrid',
    title: 'Debrid',
    description: 'Provedor que entrega à TV o link do vídeo em /api/debrid. O link nunca é guardado: ele expira.',
  },
  access: {
    id: 'acesso',
    title: 'Acesso',
    description:
      'Quem entra no painel e quem usa a API da TV. Sem token, cada um só responde para localhost.',
  },
};

const SECRET_META = {
  tmdbApiKey: {
    label: 'TMDB_API_KEY',
    hint: 'Gratuita em themoviedb.org → Settings → API.',
    missing: ['ausente — sem capas e notas', 'amber'],
  },
  adminToken: {
    label: 'ADMIN_TOKEN',
    hint: 'Protege o painel. Ao salvar, este navegador já passa a usar o novo token.',
    missing: ['ausente — só localhost', 'zinc'],
    generate: true,
  },
  apiToken: {
    label: 'API_TOKEN',
    hint: 'Protege só /api/debrid; o catálogo é sempre aberto. Vazio: debrid só para localhost, a TV não usa.',
    missing: ['ausente — só localhost', 'zinc'],
    generate: true,
  },
};

const secret = (name, secrets, { draft, onRemove }) =>
  secretField({ name, meta: SECRET_META[name], status: secrets[name], encryption: secrets.encryption, draft, onRemove });

export function tmdbGroup({ tmdb, secrets }, options) {
  const { draft } = options;
  return group(
    SECTIONS.tmdb,
    secret('tmdbApiKey', secrets, options),
    twoColumns(
      field({
        label: 'Idioma',
        hint: 'Código da TMDB, como pt-BR ou en-US.',
        input: el('input', {
          class: 'input',
          value: tmdb.language,
          pattern: '[a-z]{2}(-[A-Z]{2})?',
          required: true,
          oninput: (event) => (draft.tmdb.language = event.target.value.trim()),
        }),
      }),
      field({
        label: 'Requisições por segundo',
        input: numberInput({ value: tmdb.rps, min: 0.1, step: 0.1, required: true, onInput: (v) => (draft.tmdb.rps = Number(v)) }),
      }),
      field({
        label: 'Revalidar nota a cada (dias)',
        input: numberInput({ value: tmdb.staleDays, required: true, onInput: (v) => (draft.tmdb.staleDays = Number(v)) }),
      }),
      field({
        label: 'Votos mínimos para nota',
        hint: 'Abaixo disso a nota não aparece nem ordena.',
        input: numberInput({ value: tmdb.minVotes, min: 0, required: true, onInput: (v) => (draft.tmdb.minVotes = Number(v)) }),
      })
    )
  );
}

export function accessGroup(secrets, options) {
  return group(
    SECTIONS.access,
    el('div', { class: 'grid gap-4 xl:grid-cols-2' }, secret('adminToken', secrets, options), secret('apiToken', secrets, options))
  );
}

/** Only when something is wrong: without the key, no secret field can be saved. */
export function encryptionNotice(secrets) {
  if (secrets.encryption) return null;

  return el(
    'div',
    { class: 'mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200' },
    el('p', { class: 'font-medium' }, 'Criptografia desligada: chaves e tokens só pelo .env'),
    el(
      'p',
      { class: 'mt-1' },
      'Para salvá-los por aqui, gere uma chave com ',
      el('code', {}, 'npm run keygen'),
      ', coloque em SECRETS_KEY no .env e reinicie.'
    )
  );
}
