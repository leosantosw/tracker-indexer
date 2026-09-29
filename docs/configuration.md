# Configuration

Settings come in layers: **code defaults → `.env` → panel**. Whatever is saved
in the panel wins, and secrets are stored encrypted in the database.

**Every variable is optional.** The server starts with none of them, and most
of what matters (tokens, the TMDB key, the debrid provider) can be set from the
panel instead. The one worth setting up front is `SECRETS_KEY`: without it the
panel cannot store secrets, so tokens and keys can only come from `.env`.

Start from [`.env.example`](../.env.example).

| Variable | Default | Also in the panel | What it does |
|---|---|---|---|
| `SECRETS_KEY` | — | | AES key for the secrets saved from the panel (`npm run keygen`) |
| `ADMIN_TOKEN` | — | yes | protects the panel; if unset, the first visit to the panel creates one |
| `API_TOKEN` | — | yes | protects `/api`, except `/api/health` and the docs; without it the API does not answer |
| `TMDB_API_KEY` | — | yes | turns on posters, overviews and ratings |
| `TMDB_LANGUAGE` | `pt-BR` | yes | language of titles, overviews and genres |
| `TMDB_RPS` | `8` | yes | requests per second to TMDB |
| `TMDB_STALE_DAYS` | `30` | yes | how often matched works get their rating refreshed |
| `TMDB_MIN_VOTES` | `150` | yes | below this, the rating is hidden |
| `TMDB_RETRY_DAYS` | `14` | | retries works that did not match (`0` turns it off) |
| `DEBRID_PROVIDER` | — | yes | debrid provider (`torbox`) |
| `TORBOX_API_KEY` | — | yes | TorBox account token |
| `DB_FILE` | `./data/catalog.db` | | SQLite file |
| `API_PORT` / `API_HOST` | `3000` / `0.0.0.0` | | where the server listens |
| `HTTP_TIMEOUT_MS` / `HTTP_RETRIES` | `20000` / `3` | | HTTP client used for trackers and TMDB |
| `LOG_LEVEL` | `info` | | what the terminal prints: `debug`, `info`, `warn` or `error` |

## Access

Only `/api/health` and the API docs at `/api/docs` are open. The panel requires
the `ADMIN_TOKEN`; the catalog, search and debrid routes require the
`API_TOKEN`. Without an `ADMIN_TOKEN`, the first visit to the panel creates one
(this needs `SECRETS_KEY`).

To expose the server on the internet, put an HTTPS proxy in front of it.
