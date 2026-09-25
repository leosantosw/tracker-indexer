import { api } from '../lib/api.js';
import { el, toast } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { badge } from '../components/controls.js';

const TYPE_LABEL = { movie: 'filme', series: 'série' };

const note = (text) => el('p', { class: 'py-6 text-center text-sm text-zinc-500' }, text);

const spinner = () =>
  el(
    'div',
    { class: 'flex items-center justify-center gap-3 py-6 text-sm text-zinc-500' },
    el('span', { class: 'size-5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600' }),
    'Buscando na TMDB…'
  );

const poster = (url) =>
  url
    ? el('img', { src: url, alt: '', loading: 'lazy', class: 'h-18 w-12 shrink-0 rounded-md bg-zinc-100 object-cover dark:bg-zinc-800' })
    : el('div', { class: 'grid h-18 w-12 shrink-0 place-items-center rounded-md bg-zinc-100 text-zinc-400 dark:bg-zinc-800' }, icon('film'));

const yearFits = (candidate, year) => Boolean(year && candidate.year && Math.abs(candidate.year - year) <= 1);

const byYear = (candidates, year) =>
  candidates
    .map((candidate, index) => ({ candidate, index, fits: yearFits(candidate, year) }))
    .sort((a, b) => b.fits - a.fits || a.index - b.index);

function candidateRow({ candidate, fits }, choose) {
  const use = el('button', { type: 'button', class: 'btn btn-secondary shrink-0 self-center text-sm' }, 'Usar este');
  use.addEventListener('click', () => choose(candidate, use));

  return el(
    'li',
    { class: 'flex gap-3 px-3 py-2.5' },
    poster(candidate.poster),
    el(
      'div',
      { class: 'min-w-0 flex-1' },
      el(
        'div',
        { class: 'flex flex-wrap items-center gap-x-2 gap-y-1' },
        el('span', { class: 'font-medium' }, candidate.title),
        candidate.year && el('span', { class: 'text-sm text-zinc-500 tabular-nums' }, `(${candidate.year})`),
        fits && badge('ano bate', 'emerald')
      ),
      candidate.originalTitle &&
        candidate.originalTitle !== candidate.title &&
        el('p', { class: 'truncate text-xs text-zinc-500' }, candidate.originalTitle),
      candidate.overview && el('p', { class: 'mt-0.5 line-clamp-2 text-xs text-zinc-500' }, candidate.overview)
    ),
    use
  );
}

export function openMatchDialog(work, { onMatched }) {
  const input = el('input', { class: 'input', value: work.title, required: true, maxlength: '200', 'aria-label': 'Texto enviado à TMDB' });
  const yearInput = el('input', {
    type: 'number',
    class: 'input w-24 shrink-0 tabular-nums',
    value: work.year ?? '',
    placeholder: 'Ano',
    min: '1870',
    max: '2100',
    'aria-label': 'Ano, para ordenar os resultados',
    title: 'Não filtra a busca: só sobe para o topo quem bate com o ano (±1)',
    oninput: () => showResults(),
  });
  const results = el('div', {}, note('Edite o texto e busque.'));
  let found = null;

  const dialog = el(
    'dialog',
    {
      class:
        'm-auto w-[min(40rem,94vw)] rounded-2xl bg-white p-0 text-inherit shadow-2xl ' +
        'backdrop:bg-zinc-950/50 backdrop:backdrop-blur-sm dark:bg-zinc-900',
    },
    el(
      'div',
      { class: 'space-y-4 p-6' },
      el(
        'div',
        {},
        el('h2', { class: 'text-base font-semibold' }, 'Match manual'),
        el(
          'p',
          { class: 'mt-1 text-sm text-zinc-500' },
          `"${work.title}"${work.year ? ` (${work.year})` : ''}, ${TYPE_LABEL[work.type]}. Escolha a obra certa; as próximas atualizações seguem essa escolha.`
        )
      ),
      el(
        'form',
        { class: 'flex gap-2', onsubmit: (event) => (event.preventDefault(), search()) },
        input,
        yearInput,
        el('button', { class: 'btn btn-primary shrink-0' }, icon('search'), 'Buscar')
      ),
      el('div', { class: 'max-h-96 overflow-y-auto rounded-xl ring-1 ring-zinc-200 dark:ring-zinc-800' }, results),
      el(
        'div',
        { class: 'flex justify-end' },
        el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => dialog.close() }, 'Fechar')
      )
    )
  );

  async function choose(candidate, button) {
    button.disabled = true;
    try {
      await api.manualMatch(work.id, candidate.tmdbId);
      toast(`"${work.title}" casada com ${candidate.title}`);
      dialog.close();
      onMatched();
    } catch (err) {
      toast(err.message, 'error');
      button.disabled = false;
    }
  }

  function showResults() {
    if (!found) return;
    const year = Number(yearInput.value) || null;
    results.replaceChildren(
      found.length
        ? el('ul', { class: 'divide-y divide-zinc-100 dark:divide-zinc-800' }, byYear(found, year).map((entry) => candidateRow(entry, choose)))
        : note('Nada encontrado. Tente o título original, em inglês, ou sem subtítulo.')
    );
  }

  async function search() {
    const query = input.value.trim();
    if (!query) return;
    found = null;
    results.replaceChildren(spinner());
    try {
      found = (await api.tmdbSearch(work.type, query)).results;
      showResults();
    } catch (err) {
      results.replaceChildren(note(err.message));
    }
  }

  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  input.select();
  search();
}
