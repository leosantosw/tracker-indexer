import { el, toast } from '../lib/dom.js';
import { icon } from '../lib/icons.js';

async function copy(input) {
  const value = input.value.trim();
  if (!value) return toast('gere ou digite um token primeiro', 'warn');

  try {
    await navigator.clipboard.writeText(value);
    toast('token copiado');
  } catch {
    input.type = 'text';
    input.select();
    toast('não deu para copiar sozinho: o token está selecionado, use Ctrl+C', 'warn');
  }
}

export function copyButton(input) {
  return el(
    'button',
    { type: 'button', class: 'btn btn-secondary shrink-0', onclick: () => copy(input) },
    icon('copy', 'size-3.5'),
    'Copiar'
  );
}
