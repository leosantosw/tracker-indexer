# AGENTS.md

Rules for any agent (or person) working in this repository.

## Project

- Node >= 22. Backend in CommonJS (`'use strict'` + `require`), no build step.
- Admin panel in `web/`: React + Vite + TypeScript + Tailwind v4 + shadcn/ui, built to `web/dist` and served by Fastify at `/admin`.
- Scripts: `npm run serve | sync | enrich | stats | query | check-source | keygen`, `npm run build` (panel), `npm run dev:web` (panel with hot reload).
- Tests: `npm test` (backend, `node --test`) and `npm run test:web` (panel, Vitest).
- Architecture, API and panel docs live in `docs/`.

A task is only done when the tests of what changed pass (`npm test`, and `npm run test:web` for the panel) and the change was checked by actually running it.

## Clean code

- **No comments.** No line comments, docblocks or JSDoc in new or rewritten code. If the code needs explaining, rename it or extract a function.
- Do not delete existing comments unless explicitly asked.
- No commented-out code, no stray `TODO`, no emoji in code.
- Descriptive, complete names (`findWorkByInfohash`, not `find` or `fwbi`). Small functions with a single responsibility.
- Prefer early returns over nested `if/else`. No dead code or debug `console.log`.
- Do not duplicate: before writing a helper, look in `src/lib/` and neighboring modules.
- Match the style of the surrounding file (single quotes, `const`/arrow functions, `module.exports = { ... }` at the end in the backend).
- No new dependencies without a clear need; the Node standard library comes first.

Example of the expected style:

```js
'use strict';

const UNITS = { KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 };

function sizeToBytes(text) {
  const match = String(text ?? '').match(/([\d.,]+)\s*(KB|MB|GB|TB)/i);
  if (!match) return null;

  const value = Number(match[1].replace(',', '.'));
  return Number.isFinite(value) ? Math.round(value * UNITS[match[2].toUpperCase()]) : null;
}

module.exports = { sizeToBytes };
```

## Errors

- Never an empty `catch` or a `catch` that silently swallows the error. Catch what you expect, and log or rethrow the rest.
- Error messages shown to the user are in pt-BR.

## Organization

- A file is starting to grow? Split it into modules by responsibility instead of letting it bloat.
- New route → its own file in `src/api/**/routes/`.
- Database access stays in `src/db/`, split by entity (`items`, `works`, `search`, ...). Trackers live in `src/sources/trackers/`, one file each.

## Panel (`web/`)

- Don't reinvent components: use shadcn/ui first (`npx shadcn@latest add <name>` inside `web/`). Files in `src/components/ui/` are shadcn's; adjust them only for the theme (colors, spacing, variants).
- Panel pieces reused across screens go in `src/components/app/`. Each screen or subject gets a folder in `src/features/` (`dashboard`, `trackers`, `settings`, `unmatched`, ...).
- Server data through TanStack Query (`src/lib/queries.ts`), API responses validated with zod (`src/lib/schemas.ts`), forms with react-hook-form + zod, state that belongs in the URL with nuqs, small global state with zustand, toasts with sonner, icons from lucide-react.
- Keep stores and helpers out of component files: a `.tsx` exports only components.
- Theme tokens live in `src/index.css`; use them (`bg-card`, `text-muted-foreground`, `bg-primary`) instead of raw colors, except for the status tones (emerald, amber, rose, indigo) already used in badges and alerts.
- Check every screen in light and dark mode and at phone width.

## Language

- Code in **English**: identifiers, file names, commit messages.
- User-facing text in **Brazilian Portuguese (pt-BR)**: panel UI, log messages and error messages.

## Logs

- Logs go to stdout/stderr only. No log files, rotated logs or history/audit tables.
- Persisted operational state is fine only if it is bounded and overwritten in place (one row per tracker/term), never append-only.

## Tests and validation

- Every change gets tests: new behavior, bug fixes (a test that reproduces the bug) and new routes.
- Backend: `node:test` + `node:assert`, files in `tests/` named `<module>.test.js`, Arrange-Act-Assert pattern.
- Panel: Vitest + Testing Library, `<module>.test.ts(x)` next to the code in `web/src/`. Test logic (schemas, formatters, API client) and interactive components.
- No test touches the network or a real tracker: use an in-memory database (`openDb(':memory:')`), fixtures and stubs.
- Also validate by actually running things: start `serve`, call the API, open the panel.
- Run `npm test` (and `npm run test:web` when the panel changed) before finishing; every test must pass.

## Docs

- Changed behavior or structure? Update the matching doc in `docs/`.

## Git

- Conventional commits in English (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`), with a short message explaining why the change was made.
- Always commit at the end of every change. Don't leave work uncommitted.
- Small commits, one per change. Only push when asked.
- Never add AI attribution: no `Co-Authored-By` trailer, no "Generated with" line, no agent name anywhere in commits or PRs. The author is the git user.

## Boundaries

**Always:**
- Write tests for the change, run the tests and check the change running before calling a task done.
- Commit when the change is done.

**Ask first:**
- Adding or replacing a dependency.
- Changing the SQLite schema.
- Triggering `sync`, `enrich` or any other job on the production VM. There, "run it again" means pulling the code, running `npm run build` and restarting `serve`; jobs spend tracker requests and change the production database.
