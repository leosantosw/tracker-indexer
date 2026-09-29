<div align="center">

<img src="web/public/logo.png" alt="tracker-indexer" width="96" height="96">

# tracker-indexer

**Indexes torrent trackers, matches every title against TMDB and serves a
movie and TV show catalog ready for a TV app.**

**English** · [Português](README.pt-BR.md)

[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue)](LICENSE)
![Node](https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white)
![Fastify](https://img.shields.io/badge/fastify-5-000000?logo=fastify&logoColor=white)
![React](https://img.shields.io/badge/panel-react-61DAFB?logo=react&logoColor=black)

</div>

## Features

- **Incremental indexing** of trackers through JSON APIs or HTML, with
  throttling, retries and cancellation.
- **Release classifier:** tells movies from shows and extracts title, year,
  season, resolution, audio and HDR.
- **TMDB enrichment:** posters, overviews, genres, ratings and trailers, with
  conservative automatic matching and manual matching from the panel.
- **REST API for TVs:** lean lists, full details, search, categories,
  compression and ETags, documented with Swagger.
- **Debrid (TorBox):** hands out a direct video link without exposing the
  account token.
- **Web panel:** add and configure trackers, schedule updates, follow every run
  with a live log and keep secrets encrypted.
- **No external database:** runs on Node's built-in SQLite.

## Getting started

Requires **Node.js 22+**.

```bash
git clone https://github.com/leosantosw/tracker-indexer.git
cd tracker-indexer
npm install
npm run build             # builds the panel

cp .env.example .env
npm run keygen            # paste the generated SECRETS_KEY into .env

npm run serve             # API on :3000/api, panel on :3000/admin
```

On your first visit to **<http://localhost:3000/admin>** you create the panel
token. From there you can add trackers, set the `TMDB_API_KEY` (free at
[themoviedb.org](https://www.themoviedb.org/settings/api)) and run the first
update. The API is documented at **<http://localhost:3000/api/docs>**.

The trackers it ships with are Brazilian, so the catalog, the panel and the
guides are in Brazilian Portuguese.

### Commands

| Command | What it does |
|---|---|
| `npm run serve` | starts the API, its docs and the panel |
| `npm run sync` | updates the catalog from the command line |
| `npm run enrich` | fetches only posters and ratings from TMDB |
| `npm run check-source <tracker>` | tests a tracker's first page without saving anything |
| `npm test` / `npm run test:web` | backend and panel tests |

## Documentation

The guides are in Portuguese.

| Guide | Contents |
|---|---|
| [Configuração](docs/configuracao.md) | environment variables and access |
| [API](docs/api.md) | routes, payloads, categories, search, debrid and errors |
| [Painel](docs/painel.md) | trackers, scheduling, secrets, logs and the admin API |
| [Arquitetura](docs/arquitetura.md) | sync, enrichment, classifier, layout and how to add a tracker |

## Contributing

Issues and pull requests are welcome. Before opening a PR, run `npm test` and
`npm run test:web`. For a new tracker, include the output of
`npm run check-source`. Code conventions live in [AGENTS.md](AGENTS.md).

## Disclaimer

This project indexes **public metadata** about torrents. It does not host or
distribute any file. Respect copyright and the terms of the indexed sites;
whoever runs the server is responsible for how it is used.

This product uses the TMDB API but is not endorsed or certified by TMDB.

## License

[GPL-3.0](LICENSE) © leosantosw
