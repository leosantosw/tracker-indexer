# API

With the API running, the full, browsable reference is at
**<http://localhost:3000/api/docs>** (Swagger UI, with _try it out_). The raw OpenAPI 3.1
is at `/api/docs/json` — use it to generate a client:

```bash
curl -s http://localhost:3000/api/docs/json > openapi.json
```

Everything requires the `API_TOKEN`, except `/api/health` and the documentation:
`Authorization: Bearer <API_TOKEN>` on calls. The documentation page is
public; to use _try it out_, enter the token under **Authorize**.

**The API has two entities, and they do not mix:**

| | What | Where it comes from |
|---|---|---|
| **title** | the movie or the series: poster, synopsis, rating | TMDB |
| **torrent** | a copy of it: seeders, size, resolution | tracker |

```
GET /api/health
GET /api/stats

GET /api/categories    the home screen rows (with the first movies, if you want; ?type=series for series)
GET /api/movies        list movies     (grid card, one row per movie)
GET /api/movies/:id    one movie       (everything, with the copies inside)

GET /api/series        list series
GET /api/series/:id    one series

GET /api/search          search movies and series together (?q=, ?genre=)
GET /api/search/genres   genre shortcuts for the search screen
```

**Two requests per screen, each one sized to the screen.** The listing
brings only what the grid draws; the detail brings the rest and the copies. Designed
for TV: measured with 50 movies per page,

| | Before | Now |
|---|---|---|
| Listing, uncompressed | 30.8 KB | 11.1 KB |
| Listing, gzip/brotli | 12 KB | **3.6 KB** |
| Opening a movie | 2 requests | **1**, ~900 B |
| Reloading with no change | 30.8 KB | **304**, 0 bytes |

Every response goes out compressed (br/gzip, above 1 KB) and with an `ETag`; the public
routes send `Cache-Control: no-cache`, so the client stores the response
but always asks — and, with no sync in between, the response is an empty 304.

The `:id` is the id of the **title**, not of the torrent. The type comes from the route: `/api/series/:id`
with a movie id gives 404, and no payload carries `type`.

The four releases of *Divertida Mente* (*Inside Out*) are **one** item in `/api/movies` and four
in the `torrents` of `/api/movies/:id`. For a series, the title is the whole series and the copies are the
episodes — `season` and `episode` live on the copy, where they belong.

The listing has pagination and the chosen category:

| Parameter | Default | |
|---|---|---|
| `page` | `1` | page, starting at 1 |
| `limit` | `50` | items per page, maximum 200 |
| `category` | — | id from `/api/categories`; without it, the default order |
| `all` | `false` | includes, at the end, titles with no TMDB match: title and year from the torrent, no poster |

### Categories

They are **saved filters, not a table**: they come from the catalog itself, so they appear
and disappear on their own as the collection changes. There is nothing to register in the panel.

Movies by default. Series have the same categories, built only from series:
`/api/categories?type=series&preview=12`, with the titles in `series` instead of
`movies`, and `/api/series?category=<id>` to paginate.

| Category | What |
|---|---|
| `novidades` | `Adicionados recentemente` (Recently added), by date of entry into the catalog |
| `melhores` | `Melhores notas` (Top rated) |
| `genero-<genre>` | one per genre with at least 10 movies (`genero-terror`, `genero-acao`…) |

```json
// GET /api/categories?preview=12
{
  "categories": [
    { "id": "novidades", "title": "Adicionados recentemente", "total": 955, "movies": [ ... ] },
    { "id": "genero-terror", "title": "Terror", "total": 121, "movies": [ ... ] }
  ]
}
```

With `preview`, each category already comes with its first movies: the whole TV home
screen in **one request**. To continue a row, `/api/movies?category=<id>`
paginates as usual. An empty category is left out of the list, and an unknown `category`
gives 404.

The order is fixed, in this priority:

1. **having a rating** — any rating, not a high rating: a computed 5.1 beats no rating at all;
2. most recent **year** first;
3. **highest rating** within the year.

A title with no computed rating drops to the end of the whole list, not just of its own year. In
practice this pushes recent releases down: a 2026 movie has not yet had time
to gather 150 votes.

By default only titles that matched TMDB are included: with no poster, no synopsis and no rating
there is nothing to list. With `all=true`, titles that did not match or have not yet
been looked up (`pending`) are included too, with `poster`, `backdrop` and `rating` null. Without
`TMDB_API_KEY`, it is the only way to list anything — and `/api/stats` says why:
`tmdb.configured` comes back `false` and the titles show up as `pending`.

The response describes itself:

```json
{
  "movies": [ ... ],
  "page": 1,
  "limit": 50,
  "total": 773,
  "pages": 16
}
```

Every sort criterion ends in `id`, so paginating neither repeats nor skips a
title — without this tiebreaker, items with the same year and the same rating would change position
between two queries.

### Search

`/api/search` returns movies and series in a single list, in `results`, each one with
`type` (`movie` or `series`) so the TV knows which detail to open.

- `q` searches the TMDB title and the torrent title, ignoring accents,
  case and punctuation: `homem aranha` finds *Homem-Aranha*, `acao` finds *Ação*.
  Each typed word must be the start of a word in the title.
- Titles that start with the search come first, then those with a word that
  starts with it; within that, the most voted.
- `genre` is an id from `/api/search/genres` (`acao`, `terror`, `comedia`…) and
  combines with `q`. A shortcut applies to both movies and series: *Ação* (Action) also catches the
  *Action & Adventure* that TMDB uses for series.
- Without `q` and without `genre`, the most voted come back.
- `type=movie` or `type=series` restricts; `page`, `limit` and `all` work
  as in the listing.

```json
// GET /api/search?q=batman&limit=2
{
  "results": [
    { "id": 369, "title": "Batman: O Cavaleiro das Trevas", "year": 2008, "type": "movie", ... },
    { "id": 370, "title": "Batman vs Superman: A Origem da Justiça", "year": 2016, "type": "movie", ... }
  ],
  "page": 1, "limit": 2, "total": 7, "pages": 4
}
```

`/api/search/genres` brings only the shortcuts that have at least one title, with `total`.

### Rating only with enough votes

`rating` comes back **null below `TMDB_MIN_VOTES` votes** (150 by default). A rating of 8
computed from 4 votes is not a rating, it is noise — and it was what put unknown movies
at the top. The same rule applies to display and to sorting.

`votes` stays in the detail even when the rating is null: it is what explains why.
Today this silences **82 of the 805 visible titles** (10%) — the obscure tail, almost
all recent releases.

The listing and the detail do not carry the same thing. **In the listing, only the card**
— the synopsis alone was half the weight of the page:

```json
// GET /api/movies  ->  movies[]
{
  "id": 362,
  "title": "Interestelar",
  "year": 2014,
  "poster": "https://image.tmdb.org/t/p/w185/tR1XVa5bxgdh2bRw2u0DzrgkO2l.jpg",
  "backdrop": "https://image.tmdb.org/t/p/w780/8sNiAPPYU14PUepFNeSNGUTiHW.jpg",
  "rating": 8.487
}
```

`backdrop` stays in the listing because the TV grid usually swaps the background according to
the item in focus — it costs ~65 bytes per movie, and the image is only downloaded for the one that
gets focus.

**In the detail, everything at once**, copies included — when opening an item the TV makes
a single request:

```json
// GET /api/movies/362
{
  "id": 362,
  "title": "Interestelar",
  "year": 2014,
  "genres": ["Aventura", "Drama", "Ficção científica"],
  "poster": "https://image.tmdb.org/t/p/w342/tR1XVa5bxgdh2bRw2u0DzrgkO2l.jpg",
  "backdrop": "https://image.tmdb.org/t/p/w1280/8sNiAPPYU14PUepFNeSNGUTiHW.jpg",
  "overview": "As reservas naturais da Terra estão chegando ao fim...",
  "rating": 8.487,
  "votes": 41140,
  "trailer": "https://www.youtube.com/watch?v=i6avfCqKcQo",
  "torrents": [
    {
      "id": 325,
      "name": "Interestelar (2014) 1080p",
      "seeders": 4,
      "leechers": 0,
      "size": "2.77 GB",
      "resolution": "1080p",
      "release": null,
      "videoCodec": null,
      "audio": null,
      "hdr": null,
      "language": "dual",
      "infohash": "ac3ee9395349ad9a0b6ef13e1520511a6b9ee2b2",
      "source": "torrents-csv",
      "createdAt": "2026-09-14T07:10:30.000Z",
      "updatedAt": "2026-09-14T07:11:36.000Z"
    }
  ]
}
```

The copies come from most seeded to least. Today there are 1 to 3 per title (average
1.02), so embedding them costs little; they are left out of the listing — they would bloat the
page with what the TV only uses when opening the item.

The payload is lean on purpose. `release_date`, `last_added`, `tmdb_id` and
`status` exist in the database and are used for sorting and filtering, but **do not go out in the
response**.

A title that did not match TMDB disappears from the listing, but remains accessible through
`/api/movies/:id`, with its copies — it leaves the storefront, not the collection.

`size` is the database's `size_bytes` formatted in GB (above 1 GB) or MB.

`language` tells the copy's audio: `dual` (dubbed and original), `dubbed` (dubbed
only), `subtitled` (original with subtitles) or `null` when nothing indicates it. It comes
from the torrent name; when the name does not say, from the link's line or the section of the
tracker page (on Comando, the headings "DUBLADO", "LEGENDADO", "DUAL ÁUDIO" — dubbed, subtitled, dual audio; on
Torrent dos Filmes, the "VERSÃO MKV DUAL ÁUDIO", "VERSÃO MP4 LEGENDADO").
Two identical copies in different languages do not count as duplicates.

Direct database query, without starting anything:

```bash
npm run query "SELECT name, seeders FROM item ORDER BY created_at DESC LIMIT 10"
```

## API documentation

The Swagger is not written by hand: it comes from the same schemas that validate the
request and serialize the response, in `src/api/public/schemas.js`. A field that
is not in the schema does not appear in the documentation **and does not go out in the response** — the
two have no way to diverge.

| File | Responsibility |
|---|---|
| `api/public/schemas.js` | JSON schemas: filters, titles, copies and responses |
| `api/public/docs.js` | OpenAPI metadata and the page at `/api/docs` |
| `api/public/catalog.js` | routes for `/api/movies` and `/api/series`, each one bound to its schema |
| `api/public/dto.js` | database row → payload (image URLs, size, rating) |

There are four schemas, two per entity: `Movie`/`Series` for the title and
`MovieTorrent`/`SeriesTorrent` for the copy — each pair comes from a single function, and
the series one only adds `season` and `episode`. Every field is `required`: what
is not known goes as `null`, never absent, so the client does not need to
test for key existence.

Adding a filter is one line in `LIST_QUERY`, plus the `WHERE` in
`db/works.js`. The documentation follows on its own.

## Debrid (TorBox)

Delivers to the TV the **direct video link** of a torrent, through the debrid provider
configured under *Configurações → Debrid* (Settings → Debrid). Today the only provider is
[TorBox](https://torbox.app); the structure already supports others.

```
POST   /api/debrid/torrents          { "hash": "...", "season"?, "episode"? }  requests the video (starts the download if needed)
GET    /api/debrid/torrents/:hash    lookup only: never adds anything
DELETE /api/debrid/torrents/:hash    cancels the download / removes from the account
```

The `hash` is the `infohash` of a copy, which comes in the title's detail (40-character hex or
32-character base32).

### The flow on the TV

1. When a copy is chosen, the TV makes the `POST`.
   - **Cached on TorBox:** responds `200` and `ready` with the `url`, on the very first call.
   - **Not cached:** TorBox starts downloading and the response is `202` `downloading`, with `progress` (0–100) and `eta`.
2. While it is not `ready` or `failed`, the TV polls the `GET` every ~5 s.
   It is read-only, so repeating it costs nothing beyond the lookup.
3. On `ready`, play the `url`. If the person gives up, `DELETE`.

| `status` | Final? | Carries |
|---|---|---|
| `ready` | yes | `url`, `file` (`id`, `name`, `size`, `season`, `episode`); `files` in a pack |
| `downloading` | no | `progress`, `eta`, `state` |
| `queued` | no | all TorBox slots are taken; try the `POST` again later |
| `failed` | yes | `reason`: `no_video`, `provider_failed` or `episode_not_found` |

The `POST` is idempotent: a torrent already in the account is only described, not
added again.

### Movie, episode and pack

With a single video in the torrent — a movie or a standalone episode —, it is that one, with or without
`season`/`episode`. In a **pack** (a whole season, several seasons,
`S01E01-E02`), the response carries `files`: all the videos, by season and
episode, read from the file name (`S02E05`, `2x05`, `Episódio 05`, or `05.mkv`
in a `Temporada 2` folder). The TV chooses like this:

| Request | Video |
|---|---|
| no `season`/`episode` | the largest one that is not a `sample` |
| `season` + `episode` | the file for that episode (includes double episode `E06-E07`) |
| only `season` | the first episode of the season |
| an episode the pack does not have | `failed` with `episode_not_found`, and `files` to choose from |

On `GET`, `season` and `episode` go in the query: `/api/debrid/torrents/:hash?season=2&episode=5`.

### The link is never stored

The TorBox link expires. It goes neither to the database nor to any cache: **each
`ready` generates a new link** on the spot (`requestdl`), and the routes respond with
`Cache-Control: no-store`. The TV should request the link right before playing, and not
store it.

### Security

- **`API_TOKEN`:** the routes require `Authorization: Bearer <API_TOKEN>`, like
  the rest of the API. Without `API_TOKEN` set, they do not respond. It is a token
  separate from `ADMIN_TOKEN`: the TV does not get access to the panel.
- **The TorBox token stays on the server.** Saved through the panel, it goes encrypted into the
  database, like the other secrets. The TV never receives it, and it does not appear in
  any error.
- **Validation:** a malformed hash gives `400` before any call to TorBox.

### Errors

Always `{ "error": "...", "code": "..." }`:

| HTTP | `code` | When |
|---|---|---|
| 503 | `not_configured` / `missing_token` | debrid turned off, or no provider token |
| 404 | `not_found` | `GET`/`DELETE` of a torrent that is not in the account |
| 502 | `provider_auth` | TorBox rejected the token |
| 429 | `provider_rate_limit` | TorBox limit (300/min; 60/h for adding uncached) |
| 502 / 504 | `provider_error` / `provider_unavailable` | TorBox errored, went down or was slow |

### Cache check

The debrid does not need to be asked title by title. A **cache check** step asks the
provider which torrents of the catalog it already has cached, in batches (1,000 hashes per
call on TorBox), and stores the answer in the `debrid_cache` table: one row per
provider and infohash, overwritten on each check. A cached answer is asked again after
7 days, a missing one after 1 day; hashes that left the catalog are dropped.

It runs from *Configurações → Debrid* (*Verificar cache*, check cache), from the CLI
(`npm run check-cache`) or at the end of every catalog update when *Verificar cache após
atualizar* (check cache after updating) is on.

With it, the lists accept `cached=true`:

```
GET /api/movies?cached=true
GET /api/series?cached=true&category=novidades
```

Only works with **at least one copy cached** on the active provider enter the list —
they play at once. It uses what the check stored; with no provider configured, the list
comes back empty rather than ignoring the filter. In the detail, each copy's `cached` is
the live answer when the provider replies in time, and the stored one otherwise; `null`
means nobody asked yet. Live answers are stored too, so the filter learns from them.

A provider without a batch cache lookup simply has no check: the step is skipped with a
reason, and `cached` stays `null`.

### TorBox endpoints used

Base `https://api.torbox.app/v1/api`, with `Authorization: Bearer`:

| Our use | TorBox |
|---|---|
| already in the account? | `GET /torrents/mylist?bypass_cache=true` |
| is it cached? | `POST /torrents/checkcached?format=object` `{ hashes: [...] }` — a GET with hundreds of hashes in the URL is refused |
| start the download | `POST /torrents/createtorrent` (form, `magnet`) |
| video link | `GET /torrents/requestdl?torrent_id&file_id&redirect=false` — the token goes in the query, that is how this endpoint accepts it |
| remove | `POST /torrents/controltorrent` `{ torrent_id, operation: "delete" }` |

### Adding a provider

Create `src/debrid/<name>/` with the same contract as TorBox and add a line
to `src/debrid/index.js`, plus the token in `config.debrid.tokens`:

```js
module.exports = {
  id: 'realdebrid',
  label: 'Real-Debrid',
  secret: 'realdebridToken',        // name of the secret in the panel
  cacheBatch: 100,                   // optional: hashes per checkCached call; leave it out without a batch lookup
  create({ token, timeoutMs }) {
    return { resolve(hash), status(hash), remove(hash), checkCached(hashes) };  // same statuses as TorBox
  },
};
```

The panel's select, the token field (encrypted) and the API validation adjust
on their own.
