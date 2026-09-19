import { el } from '../../lib/dom.js';
import { field } from '../../components/controls.js';
import { secretField } from '../../components/secretField.js';
import { group } from './layout.js';
import { SECTIONS } from './groups.js';

const tokenMeta = (provider) => ({
  label: `${provider.id.toUpperCase()}_API_KEY`,
  hint: `Token da API do ${provider.label}. Fica no servidor, cifrado; a TV nunca o vê.`,
  missing: ['ausente', 'amber'],
});

/**
 * Provider select plus the token of the chosen one. Every provider's field is
 * built up front and only the selected one is shown, so switching keeps drafts.
 */
export function debridGroup({ debrid, secrets }, { draft, onRemove }) {
  const tokens = new Map(
    debrid.providers.map((provider) => [
      provider.id,
      secretField({
        name: provider.secret,
        meta: tokenMeta(provider),
        status: secrets[provider.secret],
        encryption: secrets.encryption,
        draft,
        onRemove,
      }),
    ])
  );
  const show = (id) => tokens.forEach((node, key) => (node.hidden = key !== id));

  const select = el(
    'select',
    {
      class: 'input sm:max-w-xs',
      onchange: (event) => {
        draft.debrid.provider = event.target.value || null;
        show(event.target.value);
      },
    },
    el('option', { value: '' }, 'Desligado'),
    debrid.providers.map((provider) =>
      el('option', { value: provider.id, selected: provider.id === debrid.provider }, provider.label)
    )
  );
  show(debrid.provider);

  return group(SECTIONS.debrid, field({ label: 'Provedor', input: select }), [...tokens.values()]);
}
