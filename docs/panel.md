# Panel

With `serve` running, **<http://localhost:3000/admin>** updates the catalog,
cancels whatever is running, shows the live log and edits the configuration.
It is a single page:

| Where | What |
|---|---|
| Top | status, *Atualizar catálogo* (update catalog), *Buscar capas e notas* (fetch posters and ratings), *Cancelar* (cancel); icons for documentation, settings and theme (dark by default; light, dark or the system one, stored in the browser) |
| Summary | indexed torrents, matched titles, last and next run; the *Filmes e séries* (movies and series) and *Match com a TMDB* (TMDB match) cards show the catalog breakdown and the match distribution |
| Activity | when idle, it becomes a single line with the summary of the last run; while running, it shows the steps with real progress (trackers, then posters and ratings) and the warnings; the technical logs are collapsed under *Ver logs* (view logs), with the filters *Normal* (normal), *Detalhado* (detailed, includes debug) and *Problemas* (problems, only warnings and errors) |
| Trackers | only the added trackers, one row per tracker: *Testar* (test), *Buscar torrents* (fetch torrents) for that tracker only, and the active rules as icons; clicking opens its page. *Adicionar tracker* (add tracker) lists the missing ones and takes you to the configuration before adding |
| No TMDB match | titles with torrents that did not match (`not_found`) or were ambiguous (`ambiguous`), ordered from those with the most recent torrent to the oldest; shows the title and year used in the search, and the raw torrent names when hovering the title; filters by status and by tracker, 5 at a time. *Apagar resultados* (delete results) deletes the torrents of the titles shown by the filter (with a tracker selected, only that tracker's); the titles come back if the tracker publishes the torrents again. *Match manual* (manual match) opens the TMDB search with editable text: the chosen title is stored (`manual_tmdb_id`) and revalidation then queries by that id, without redoing the search. Clicking *sem match* (no match) or *ambíguas* (ambiguous) in the summary brings you here |
| Tracker page (`/admin/trackers/<nome>`) | rps, pages, early stop, rules, terms and the danger zone (*Apagar resultados*, *Remover tracker* (remove tracker)). For a tracker not yet added, the same page opens at `/admin/trackers/<nome>/adicionar` with the *Adicionar tracker* button |
| Settings (`/admin/configuracoes`, `?secao=tmdb` opens a section directly) | full page, one section per subject and each key next to what it enables: scheduling; TMDB + `TMDB_API_KEY`; debrid + the provider's token; access (`ADMIN_TOKEN`, `API_TOKEN`) |

Adding and removing a tracker is the same `enabled` from the configuration: added is
`enabled: true`, removed is `enabled: false`. Removing does not delete the torrents already
indexed; that is what *Apagar resultados* is for.

The names on screen are for the user; code, CLI, API and log still use
`sync` and `enrich`:

| On screen | Job | What it does |
|---|---|---|
| Atualizar catálogo | `sync` | fetches torrents from the active trackers and, at the end, posters and ratings |
| Buscar torrents (in the list) | `sync` with `sources: [nome]` | the same, only on that tracker |
| Buscar capas e notas | `enrich` | TMDB only, without touching the trackers |

The panel is a React app in `web/` (Vite, TypeScript, Tailwind v4 and shadcn/ui
components). `npm run build` generates `web/dist`, which `serve` itself serves at
`/admin`; any panel route returns `index.html` and React Router decides
the screen. Without the build, `/admin` responds 503 asking for `npm run build`. The filters
of the *Sem match* list live in the URL (`?status=ambiguous&tracker=comando`), so
you can share or reload without losing the view.

To work on the panel, `npm run dev:web` starts Vite on :5173 with hot reload and
proxies `/api` to `serve` on :3000.

**Log.** Each line has the time, level (`DEBUG`, `INFO`, `AVISO`, `ERRO`), source
(the tracker, `tmdb`, `execução`, `agendamento`, `servidor`...) and the message. It is one
event per line: start and end of each run, one summary per tracker (pages,
new items, why it stopped and how long it took) and one for TMDB. The detail of each search
term goes to `DEBUG`. In the terminal the columns come out aligned and colored, and
`DEBUG` only shows up with `LOG_LEVEL=debug`. Nothing is written to disk: the panel
keeps the last 500 lines in memory.

```
01:02:03  INFO   execução          Atualização do catálogo iniciada
01:02:05  INFO   redes-torrents    2 páginas · nenhum novo · parou após 2 páginas sem novidade · 1,8s
01:02:08  INFO   comando           2 páginas · +3 novos · 2,9s
01:02:12  INFO   tmdb              3 obras consultadas · 3 casadas · 3,8s
01:02:12  INFO   execução          Atualização do catálogo concluída em 9s · +3 torrents novos · 3 obras casadas
```

**One job at a time.** Requesting another while one is running returns 409. Cancelling interrupts even
the request in progress; the tracker's rules are left for the next run.

The panel's last run is stored in the `app_state` table (a single row,
overwritten on every run), so the summary is still there after restarting the
server or after *Restaurar padrões* (restore defaults). Runs from the CLI (`npm run sync`) do not
go through the panel and are not included in that summary.

The result of each run is `done`, `skipped`, `cancelled` or `failed`, and
may carry a `reason` that the panel turns into text and a shortcut:

| Situation | Result | `reason` |
|---|---|---|
| *Buscar capas e notas* without `TMDB_API_KEY` | `skipped` (*pulada*) | `no-tmdb-key` |
| *Atualizar catálogo* without `TMDB_API_KEY` | `done`, with a warning: the torrents came in | `no-tmdb-key` |
| *Atualizar catálogo* with TMDB down | `done`, with a warning | `tmdb-failed` |

The *Buscar capas e notas* button already warns beforehand, with an amber dot, when the
key is missing.

**The configuration comes in layers:** what the source declares in code, then the
`.env`, then what was saved in the panel (`setting` table). This also applies to the
CLI's `npm run sync`. Trackers, update and TMDB take effect from the next
run; `TMDB_MIN_VOTES` and the secrets take effect on the very next request.
*Restaurar padrões* deletes what was saved, except the secrets.

**The log is not stored.** It goes to the terminal and to the screen; the server keeps only
the last 500 lines in memory, for whoever opens the panel in the middle of a run.

### Scheduling

In *Configurações → Agendamento* (Settings → Scheduling) the catalog updates itself. The run is the
same as the *Atualizar catálogo* button: it fetches the torrents and, at the end, posters and ratings.

| Mode | Example | How it counts |
|---|---|---|
| At a fixed time | every day at 23:00; or only Mon and Wed at 08:30 | by the server clock |
| At an interval | every 1 minute, every 6 hours (up to 7 days) | from the **end** of the previous run |

- **Nothing piles up.** The interval counts from the end of the previous one, so a long
  run does not run over the next. If one is already running at the scheduled time
  (a manual one, for example), the scheduled run is skipped and the log records it.
- **Changed the configuration? It applies right away:** the scheduler re-arms on save.
- **Only with `serve` running.** The CLI (`npm run sync`) stays manual.
- The panel shows the next one in *Última execução* (last run); the API, in
  `GET /api/admin/status` → `schedule.nextRunAt`.
- It comes turned off. It is a panel setting, with no variable in `.env`.

### Deleting results

In the danger zone of the tracker page. It asks for a simple confirmation, and the
server refuses while a job is running — a sync
in progress would bring part of the rows back right away.

It deletes only that tracker's torrents. The TMDB titles and posters stay: they are a cache,
and if the torrent comes back in the next sync the poster is already there, with no new query.

### Debrid cache

With a provider that has a batch cache lookup (TorBox), *Configurações → Debrid* shows:

- *Verificar cache após atualizar* (check cache after updating): every catalog update ends
  with a third step that asks the debrid about the torrents that are new or whose answer
  expired. Off by default.
- *Cache por tracker* (cache per tracker): how many of each tracker's torrents are cached,
  how many are still unchecked, and the *Verificar cache* (check cache) button to run the
  check on its own.

The run card shows the step as *Cache do debrid*, and the summary says how many were
checked and how many are cached.

### Private trackers

A private tracker comes out of the updates until someone adds it. Its page has a *Conta*
(account) section with the username and the password, required to add it; they are
secrets, so they need `SECRETS_KEY`, never come back to the screen and never travel with
the tracker list. *Remover do painel* on either field stops the tracker's sync until they
are entered again. Where the tracker supports it, *Apenas freeleech* (freeleech only) keeps
only torrents whose download does not count against the account's ratio.

### Secrets

`TMDB_API_KEY`, `ADMIN_TOKEN`, `API_TOKEN` and `TORBOX_API_KEY` can come from `.env` or be
set through the panel. A private tracker's username and password exist only in the panel.
The panel's value wins; *Remover do painel* (remove from panel) restores the one from `.env`.

What is saved through the panel goes to the database **encrypted**, with the
`SECRETS_KEY` key from `.env`:

```bash
npm run keygen     # prints SECRETS_KEY=... to paste into .env
```

- **AES-256-GCM**, random IV per value, 16-byte tag. Tampering with the
  ciphertext makes the read fail instead of returning garbage.
- **Each value is bound to its field** (associated data): copying the encrypted token
  into the TMDB key's slot does not decrypt.
- **The value never comes back to the screen.** The API only says where it comes from (`panel`,
  `env` or none); the field is write-only.
- **Without `SECRETS_KEY`**, saving a secret through the panel is refused. An invalid key
  brings down the boot with a message on how to generate one.
- **Changed the key?** What was encrypted with the old one is ignored, nothing breaks:
  `.env` applies, and the panel shows a warning to enter it again.

What this protects: a copy of `catalog.db` (backup, shared file)
does not hand over the TMDB key or the token. What it does not protect: whoever reads `.env` reads
the `SECRETS_KEY` — keep `.env` out of the repository, as it already is in
`.gitignore`.

**Access:** the panel API always requires the `ADMIN_TOKEN`. It does not need to be
in `.env`: on first access, the panel asks you to create the token (or generate one), and
it goes encrypted into the database — which is why `SECRETS_KEY` is required. Whoever opens
the panel first sets the token, from anywhere: open it right after starting
the server. Once the token is created, that path closes, and the panel refuses to remove it (only
replace it) when `.env` does not have one. With
it, the panel asks for the token and stores it in the browser; changing the token through the panel
takes effect immediately and the browser that changed it starts using the new one right away. The token travels
in plain text over HTTP: to expose the panel outside the machine, put a proxy with
HTTPS in front of it. The panel routes are left out of Swagger.

| Route | |
|---|---|
| `GET /api/admin/status` | current job, last result and numbers |
| `POST /api/admin/jobs/sync` | `{ sources?: [...] }` restricts the trackers |
| `POST /api/admin/jobs/enrich` | |
| `DELETE /api/admin/jobs/current` | cancels |
| `DELETE /api/admin/sources/:name/items` | deletes a tracker's torrents |
| `POST /api/admin/sources/:name/check` | tests the tracker: reads the 1st page and says what would come in, without saving |
| `GET /api/admin/events` | SSE: `status` (with the run's `progress`), `schedule` and `log` |
| `GET` `PUT` `DELETE /api/admin/settings` | reads, partially updates (including `secrets`), restores |
