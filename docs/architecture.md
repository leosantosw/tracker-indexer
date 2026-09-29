# Architecture

How the catalog is built: sync, enrichment, classifier and trackers.

## How the sync works

The tracker's API has a single endpoint:

```
GET /service/search?q=<term>&after=<cursor>  ->  { torrents: [...], next: <id|null> }
```

Three consequences shape the job:

- **`q` is required** (at least 3 characters) and there is no "most recent"
  route. Coverage comes from the list of terms in `src/sources/trackers/torrentsCsv.js`,
  which is also the pt-br slice. The search ANDs the terms together, so a
  compound term is a subset of the simple one — `dublado 1080p` never returns
  anything that `dublado` doesn't already have.
- **Results come sorted by seeders, never by date.** Sorting by date is our
  database's job.
- **The `id` in the response is the seeders rank, not an insertion key.** It
  changes when the tracker's database is rebuilt, so it works as a cursor within
  a run and nothing more.

Each run pages through every term to the end. It looks wasteful, but it isn't:
since results are sorted by seeders, **a new torrent with few seeders starts at the end
of the list** — stopping early would mean never reaching exactly that one.

Duplicates are not a problem: the `(source, source_id)` key makes the upsert
idempotent, and `created_at` is never overwritten. Measured against the real service: 1st run
1286 items, 2nd run 0 new, no duplicates.

A source can set `stopAfterQuietPages: N` to give up on a term after
N consecutive pages with nothing new. It is worth it where each request is expensive — a
private tracker with a daily limit — and not here.

### Per-tracker rules

A source can declare rules that apply **only to its own catalog** — what
cleans up one tracker doesn't touch the others:

```js
rules: { requireYear: true, dedupe: 'seeders' },
```

| Rule | What it does |
|---|---|
| `requireYear` | deletes items without a year — without it there is no way to match against an external catalog |
| `dedupe: 'seeders'` | for the same work, only the most seeded copy is kept |

A duplicate is the same `(type, title, year, season, episode)`, so a series
episode doesn't run over another episode, and a remake doesn't run over the original (`Cinderela` from
1950 and from 2015 coexist). A tie in seeders goes to the oldest item, so the
choice doesn't flip-flop between runs.

The rules run **at the end of the run**: duplicates arrive through different pages and terms,
and they can only be seen with the whole database at hand. As a side
effect, they also clean up whatever came in before the rule existed.

On the way in, whatever can already be known is blocked before being written: an item without a year doesn't
get in, and neither does a copy that would lose the dedup to one already stored. Without this,
what the end of the run deletes would come back as "new" in the next run — inflating the log
and keeping `stopAfterQuietPages` from ever seeing a quiet page.

On `torrents-csv`, with both enabled, **1286 items go down to 995** (−196 without a year,
−95 duplicates, 22.6%).

**Dedup picks by seeders, not by quality.** A 720p with 7 seeders beats
a 1080p with 3 — that is what happened with `Ainda Estou Aqui` and `Divertida Mente`
in the current database. If the desired criterion is resolution, the ordering lives in
`DEDUPE_BY_SEEDERS`, in `db/repo.js`.

## Enrichment (TMDB)

The catalog's second step: it matches each work against [TMDB](https://themoviedb.org)
and stores the cover, synopsis and rating. It runs at the end of `sync` and also on its own, with
`npm run enrich`.

**The unit is the work, not the torrent.** The four releases of *Divertida Mente* (Inside Out)
are a single lookup and point to the same `work` row:

```
item                                        work
──────────────────────────────────────      ───────────────────────────────
Divertida Mente (2015) 720p BluRay   ─┐
Divertida Mente (2015) 1080p BluRay  ─┼──→  movie | Divertida Mente | 2015
Divertida Mente (2015) 720p          ─┘     tmdb_id 150540, rating 7.9
```

### Series

A series work is `(series, title)`, **without a year**: the year in the torrent name is the
season's year (*Prison Break* shows up with 2005, 2006, 2008 and 2009), and with it one
series would become four works. All episodes and packs point to the same
`work` row — the series, which is what `/search/tv` returns.

Each torrent stores its coverage in `season`/`season_end` and
`episode`/`episode_end`, read by `lib/classifier/series.js`:

| Name | Coverage |
|---|---|
| `S03E05` · `3x05` · `Cap.305` | season 3, episode 5 |
| `S01E01-02` · `01º AO 02º EPISÓDIO` | season 1, episodes 1 to 2 |
| `S02` · `2ª Temporada Completa` | all of season 2 |
| `S01-S03` · `1ª a 3ª Temporada` | seasons 1 to 3 |

Without a year, the match uses the exact title (in Portuguese, the original, or without the
franchise prefix: `Star Wars: Andor` → `Andor`). A single candidate is accepted. When there are
namesakes, the torrents break the tie: the series must have the highest season
seen and must have aired each season in the torrent's year (±1, or the exact premiere
year). That is what tells the two *Ghosts* apart: `S04 (2022)` is the British one, `S04 (2024)`
the American one. After that, the 2× popularity margin applies.

`requireYear` applies only to movies: episodes without a year are common and don't prevent a match.

### Why it is a separate step

- **After the tracker rules.** They delete ~23% of the catalog; looking things up
  before would spend almost a quarter of the calls on items that are about to go away.
- **Failing doesn't bring the sync down.** At that point the tracker data is already written.
  A torrent that disappears doesn't come back; a cover comes back on the next run.
- **Reprocessable.** Changed the match rule or want to refresh the ratings? Run
  `enrich` without scanning any tracker.

### The match rule

A wrong cover is worse than no cover, so when in doubt the item stays unenriched.

| Situation | Decision |
|---|---|
| Has a year | accepts the result whose year matches ±1; among several, the most popular |
| No year, exact and unique title | accepts |
| No year, exact title with a tie | accepts only if the 1st is 2× more popular than the 2nd |
| Collection (`Trilogia`, `Saga`…) | doesn't even look it up — there is no corresponding work |
| Nothing is convincing | stays `ambiguous`, without a cover |

The ±1 exists because TMDB stores the original premiere and the Brazilian release
usually uses the local premiere, which comes later. The year does **not** go into the query: TMDB's
filter is exact and would cut out precisely this case.

### What makes it cheap to always run

Failure is recorded too. The `status` is what keeps it from asking about
`Hexalogia Star Wars` on every run, forever:

| `status` | Meaning | Looked up again? |
|---|---|---|
| `ok` | matched | yes, every `TMDB_STALE_DAYS` (ratings change) |
| `not_found` | TMDB doesn't know it | yes, every `TMDB_RETRY_DAYS` (recent release not yet registered) |
| `ambiguous` | found candidates, none trustworthy | yes, every `TMDB_RETRY_DAYS` |
| `skipped` | collection, never looked up | no |
| `pending` | created by the sync, hasn't gone through TMDB yet | yes, on the next run with a key |

### How many requests it costs

| Case | Calls |
|---|---|
| Work that matched | **2** — the search, plus the details call the trailer comes from |
| Work that didn't match | **1** — just the search |
| Collection | **0** — the regex cuts it before any request |
| Genre dictionary | **2 per run**, not per work |

Almost everything comes in a single response: cover, backdrop, genres, date, rating and synopsis
come from the same search. **The trailer is the only exception** — the search returns no video
at all. That is why it is fetched after the match (a work that didn't match doesn't pay) and
**only once per work**: `trailer_checked` marks what has already been looked up, found
or not, and rating revalidation never pays the second call again. A failure there
returns `null` instead of invalidating a match that already worked.

On the first run there are ~983 works (~2 min at 8 rps, or ~3.5 min counting the
trailers). After that, only the new ones.

`npm run stats` shows the distribution by `status`.

The `TMDB_MIN_VOTES` floor solves the classic case: without it, a rating of 10 from
1 vote beat *Interestelar* (Interstellar) with 41 thousand.

### Images and trailer

There are two images, both with a direct URL on TMDB's CDN — no key and no
limit:

| Field | What | Listing | Detail |
|---|---|---|---|
| `poster` | vertical cover | `w185` | `w342` |
| `backdrop` | horizontal, for background and banner | `w780` | `w1280` |

The TV grid calls for a small image; the open item screen, a larger one. On the TV, the
images weigh much more than the JSON: 50 covers add up to around a megabyte, against
~3.6 KB for the compressed page. Load the covers as they come into view.

The database stores only the path (`/abc.jpg`); the DTO builds the URL, with the
`SIZES` table in `api/public/dto.js`. Changing a size is one line, with no reprocessing
at all. `backdrop` is null more often than
`poster` — 803 versus 871 in the current database.

The `trailer` is a YouTube link, built from the video id. Among the
dozens of videos TMDB returns (clip, behind the scenes, featurette), the choice is made
by score: a trailer is worth more than a teaser, dubbed more than subtitled, and
official breaks ties. Nothing below a teaser will do.

**Don't download the images.** Hosting them would be ~50 MB at `w342` for the 871 works,
with the cost of maintaining and serving them — and TMDB's CDN does it for free and faster.

### Genre

`genres` comes from TMDB, in the `TMDB_LANGUAGE` language. The search returns only numeric
ids, so enrich loads the genre dictionary **once per
run and per type** — that is two requests for the whole run, not one per work.

In the database it is a `TEXT` column (`"Terror, Thriller"`), the same convention as `audio`
and `hdr` in `item`. With no genre filter in the API, one column is enough and avoids a join
table. In the response it becomes an array.

## Classifier

`src/lib/classifier/` takes the raw name and decides whether it goes into the catalog, as well as
extracting the metadata and normalizing the title.

```js
classify('Procurando Nemo 2003 Dublado 720p BRrip x264')
// {
//   rejected: false,
//   title: 'Procurando Nemo',
//   canonical: 'Procurando Nemo (2003) 720p BRRip x264',
//   year: 2003, type: 'movie', season: null, episode: null,
//   resolution: '720p', source: 'BRRip', videoCodec: 'x264',
//   container: null, audio: [], hdr: []
// }
```

**The filter is an allowlist, not a blocklist.** Instead of enumerating what we don't
want (exe, zip, rar, games, software), it is enough to require a movie marker:
resolution, source, codec, container, audio or season. Whatever has none
of them is not a movie — and that knocks out Windows, Corel and FIFA on its own, with no list.

The only exception that needs an explicit block is cinema captures
(CAM, TS, TC, SCR): they *do* have the markers (`1080p TC`), but the quality is useless.

Measured on the real database: 1522 raw items → 1286 accepted, with **zero** software,
games or archives getting through.

### Files

| File | Responsibility |
|---|---|
| `index.js` | chain of classifiers |
| `normalize.js` | HTML entities, accents, dictionary lookup |
| `tags.js` | marker dictionaries (resolution, source, codec, audio, HDR) |
| `title.js` | title cleanup and extraction |
| `release.js` | builds the result |
| `filter.js` | accepts or rejects |

Adding a classifier means creating the file and adding one line to
`index.js`. Contract:

```js
{ name, classify(text, raw, result) }  // -> fields to merge; `rejected` stops the chain
```

### Title normalization

The stored `name` is the normalized title; the original stays in `raw_name` — that way
the database can be reprocessed without syncing again.

```
www.UIndex.org  -  The Warning Live (2025) 2160p 4K WEB 5.1-WORLD
  -> The Warning Live From Auditorio Nacional CDMX (2025) 2160p WEB

[Darkmahou.io] One Piece - 1168 [1080p HEVC][PT-BR].mkv
  -> One Piece E1168 1080p HEVC
```

## redes-torrents

The second tracker, with the opposite format to the first: **an HTML catalog, no API**.

| | torrents-csv | redes-torrents |
|---|---|---|
| Format | JSON | HTML |
| Scan | by search term | by page (`/pagina/N/`) |
| Recent listing | doesn't exist | exists, newest first |
| Magnet | comes in the search | only on the title's page |
| seeders | yes | **not published** |
| infohash | hex | **base32** |

Three consequences:

**`stopAfterQuietPages` finally pays off.** Since the site lists from newest
to oldest, once it hits a page with nothing new it can stop. On
torrents-csv this would be wrong — it sorts by seeders, and a new torrent starts at the
end of the list.

**Each title costs its own request:** 1 listing + 20 details = 21
requests for 20 items. With `rps: 1`, a scan of the first 10 pages
takes ~4 min. It is the opposite of torrents-csv, where one response brings the whole page
ready to use.

**Without seeders, `dedupe: 'seeders'` can't be enabled** — there is nothing to
break the tie with. Since rules are declared per tracker, this doesn't affect
torrents-csv.

### The name trick

The magnet's `dn=` carries the release markers **before** the name, and the classifier
cuts the title at the first marker — the result would be a title like
`WEB-DL 1080P MKV`. That is why the clean name, which the listing publishes in
`data-title`, goes in front:

```
"Aposta de Alto Risco" + ". " + "SITE.COM-.WEB-DL.1080P.-.Aposta+de+Alto+Risco.2026..."
  -> title: "Aposta de Alto Risco", year: 2026, 1080p, WEB-DL, x264
```

This way there is no need to scrape any metadata from the HTML: just the magnet and the size.

### Fragility and courtesy

Extraction is done with CSS selectors (cheerio), declared in the tracker itself using the
`defineHtmlSource` template. If the site's template changes, the source starts indexing zero — that is why it **warns in the log** when a page yields
cards but no magnet. It is also the symptom of a Cloudflare challenge: HTTP
200, large HTML, zero useful content.

The site sits behind Cloudflare in CDN mode, with no JS challenge: Node's `fetch`
gets straight through. Even so, `rps: 1`, a browser User-Agent and no
parallel requests — `robots.txt` allows general crawlers, but doesn't declare a
`crawl-delay`.

It carries movies and series. To tell which is which, it uses the site's `data-tipo` plus the
presence of "Temporada" (season) in the title. The site publishes **one torrent per episode** (or
per range of episodes), and the episode name comes from the link's context, together with the
post's title.

## amigos-share-club (private)

The first private tracker: it needs an account, and nothing is read without logging in.
It comes **disabled**; the panel's *Adicionar tracker* asks for the username and the password,
which are stored encrypted like any other secret (so `SECRETS_KEY` is required).

**Session.** The site is Laravel + Inertia: each page carries its data as JSON in
`<script data-page="app">`. Every run logs in once (`GET /login` for the `XSRF-TOKEN`
cookie, then `POST /login` with the Inertia headers) and keeps the cookies **in memory
only**: nothing about the session is written anywhere, and it dies with the run. If the site
sends the request back to `/login` mid-run, the session logs in again **once**; a second
refusal stops the tracker with a clear message instead of looping. Wrong credentials never
retry. The shared logic lives in `src/sources/private/inertiaSession.js`.

**Scan.** By page, newest first (`released_at`, the site's default order), one term per
category: `filmes` (4), `anime-filmes` (59), `series` (3), `anime-series` (61). The
tracker's `content` picks which ones run. 96 per page, the largest the site accepts — other
values (and other sort orders) are answered with a redirect to the login page.
*Apenas freeleech* (`freeleechOnly`) adds `freeleech=1` to the listing.

**Detail only for what is new.** The listing has no infohash, so each torrent costs a
request to its page. `fetchPage` receives `isKnown(ids)`, which asks the database which
ids of the page are already stored: only the others open the detail. The first run of the
default configuration costs up to 4 × 3 × 96 detail requests at 1 rps (~20 min); the next
ones, only what is new. The flip side: seeders of known torrents are not refreshed.

**Release name.** The listing's name is the site's title ("Filme 2024"), without the release
markers. The name comes from the first video file of the torrent (padding files in `.pad/`
are ignored), keeping the episode token of the listing — or the season range, for packs.

**IMDb.** The torrent's page carries the IMDb id. It is stored in `item.imdb_id` and the
enrichment tries it first: `/3/find/{imdb}` on the TMDB, in the work's type. Only when the
TMDB does not know that id does it fall back to the search by title.

## Adding a tracker

Create the file and add one line to `src/sources/index.js`:

```js
module.exports = {
  name: 'meu-tracker',
  site: 'https://meu-tracker.com',   // the panel opens this address
  access: 'public',                // 'public' or 'private': the tag the panel shows
  rps: 2,
  terms: ['dublado'],                     // scan by search...
  pages: 10,                              // ...or by page, one or the other
  stopAfterQuietPages: 3,                 // optional: expensive requests
  rules: { requireYear: true },           // optional: see "Per-tracker rules"

  create({ getJson, getText }) {
    return {
      async fetchPage({ term, cursor, log, isKnown }) {
        // -> { items, nextCursor }
      },
      toItem(raw) {
        // -> { sourceId, infohash, name, sizeBytes, createdUnix, seeders, leechers, imdbId? }
      },
    };
  },
};
```

A source declares `terms` (scans by search) or `pages` (scans by page). The
`fetchPage` is `async` and can make as many requests as it needs before
returning — that is how redes-torrents fetched each title's magnet without
changing the contract.

In the `defineHtmlSource` template, a title's page can have a single magnet
(`detail.fields.magnet`, as in redes-torrents) or one per quality
(`detail.magnets: 'a[href^="magnet:"]'`, as in comando): in that case each
magnet becomes an item, with the size read from the text next to the link.

The rest of the application doesn't change.

## Structure

```
src/
├─ index.js                  CLI
├─ config.js                 env with defaults
├─ settings/                 effective config: code + env + panel
│  ├─ index.js               cached store, invalidated on every write
│  ├─ merge.js               merges defaults, env and what was saved
│  ├─ secrets.js             encrypted secrets: open, apply, write
│  └─ errors.js
├─ api/
│  ├─ server.js              builds the app: /api, /api/debrid, /api/admin and /admin
│  ├─ auth.js                required token (panel and API)
│  ├─ public/                read API
│  │  ├─ index.js            /health, /stats and the catalogs
│  │  ├─ catalog.js          movie and series routes
│  │  ├─ dto.js              database row -> payload
│  │  ├─ schemas.js          JSON schemas (validation + serialization + Swagger)
│  │  └─ docs.js             Swagger UI at /api/docs
│  ├─ debrid/                TV routes: request, check and remove
│  │  ├─ index.js            auth, no-store and errors with code
│  │  └─ schemas.js          hash validation + Swagger
│  └─ admin/                 panel API
│     ├─ index.js            wires up feed, runner, auth and routes
│     ├─ schemas.js          validation for the panel routes
│     └─ routes/             jobs, settings, sources, events (SSE), ui (serves web/dist)
├─ debrid/                  debrid providers
│  ├─ index.js               registry and creation from config
│  ├─ errors.js              DebridError: HTTP + stable code
│  └─ torbox/
│     ├─ index.js            resolve, status, remove
│     ├─ api.js              HTTP calls to TorBox
│     └─ files.js            which file is the video; TorBox status -> ours
├─ job/
│  ├─ checkSource.js         checks a tracker's 1st page, without writing
│  ├─ pipeline.js            sync + enrich, used by the CLI and the panel
│  ├─ runner.js              one job at a time, with cancellation
│  ├─ summary.js             log texts: summary per tracker, for TMDB and at the end of the run
│  ├─ scheduler.js           triggers the update at the time saved in the panel
│  ├─ schedule.js            next run and description (pure functions)
│  ├─ sync.js                pagination and stop criterion
│  └─ enrich.js              matches each work against TMDB
├─ db/
│  ├─ index.js               connection, schema, migrations and transaction
│  ├─ repo.js                facade over the tables
│  ├─ items.js               item table: writes, rules and cleanup per tracker
│  ├─ works.js               work table: work, enrichment and API reads
│  ├─ settings.js            setting table: what was saved in the panel
│  └─ state.js               app_state table: operational state, one row per key, overwritten
├─ lib/
│  ├─ classifier/            see above
│  ├─ http.js                fetch with throttle, retry and cancellation
│  ├─ feed.js                live log and status, in memory only
│  ├─ logger.js              lines with level and origin; aligned terminal format
│  ├─ duration.js            human-readable duration: <1s, 1,8s, 42s, 1m05s
│  ├─ infohash.js            hex/base32 -> hex, magnet
│  └─ secrets.js             AES-256-GCM and key generation
├─ sources/
│  ├─ index.js               registry
│  ├─ content.js             movies, series or both, per tracker
│  ├─ trackers/              one file per tracker (torrentsCsv, redesTorrents, comando, torrentDosFilmes)
│  ├─ html/                  template for HTML trackers (defineHtmlSource, selectors, post title)
│  └─ tmdb/                  search and match: candidate, movie, series, trailer
```

The panel lives outside `src/`, in its own app:

```
web/                         React + Vite + TypeScript + Tailwind v4 + shadcn/ui
├─ src/
│  ├─ app.tsx                providers: theme, TanStack Query, tooltips, toasts
│  ├─ router.tsx             routes under /admin, each page loaded on demand
│  ├─ layout/                header, job pill, progress bar
│  ├─ components/ui/         shadcn components (generated by the CLI, adjusted to the theme)
│  ├─ components/app/        panel pieces reused across screens
│  ├─ features/              one folder per topic: dashboard, activity, trackers,
│  │                         unmatched, settings, access, live (SSE), jobs
│  ├─ hooks/                 generic hooks
│  └─ lib/                   API client, zod schemas, formatting, texts, stores
└─ dist/                     build served by Fastify (not in git)
```

## Known limitations

- **Migrations are a list, not a framework.** `CREATE TABLE IF NOT EXISTS` doesn't
  alter an existing table, so a new column goes in through the `MIGRATIONS` array in
  `db/index.js`: each entry runs at most once, and `PRAGMA table_info` is what
  decides. An entry can carry `reset: 'UPDATE work SET
  checked_at = 0'` to invalidate the cache and let the next `enrich` fill in
  the column — that is how `release_date` was added. There is no rollback and no versioned
  ordering; for a big change, deleting the database and resyncing is still
  the way to go.
- **Orphaned `work` rows are not cleaned up.** When the tracker rules or *Apagar
  resultados* (Delete results) remove items, the work stays in the table. It disappears from the routes and
  counts (`/api/stats` and the panel only count works with at least one torrent),
  but it stays in the database as a cache: if the release comes back, the cover is already
  there, with no new TMDB lookup.
- **Without `TMDB_API_KEY`, the showcase comes back empty.** The works exist from the sync on,
  as `pending`, but the default listing only shows what matched on TMDB: use
  `all=true` to see the rest, and the detail (`/api/movies/:id`) always works.
- **All copies come in the detail, without pagination.** Today the maximum observed is 3
  per work; if a series tracker brings in hundreds of episodes, this changes.
- **Tracker rules really delete.** `requireYear` and `dedupe` do a
  `DELETE`; the item comes back on the next sync if it still exists on the tracker, but its
  `created_at` starts over.
- **`updated_at` advances on every sync**, even when nothing changed in the item — it
  marks "last time it was seen", not "last time it changed".
- **Coverage limited to the terms.** A dubbed release that doesn't match any
  of the 11 terms is invisible to the job.
