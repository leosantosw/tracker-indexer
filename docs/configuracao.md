# Configuração

A configuração vem em camadas: **padrões do código → `.env` → painel**. O que
for salvo no painel vale mais, e os segredos vão cifrados para o banco.

O ponto de partida é o [`.env.example`](../.env.example).

| Variável | Padrão | |
|---|---|---|
| `DB_FILE` | `./data/catalog.db` | arquivo do SQLite |
| `API_PORT` / `API_HOST` | `3000` / `0.0.0.0` | onde a API escuta |
| `SECRETS_KEY` | — | chave AES dos segredos salvos pelo painel (`npm run keygen`) |
| `ADMIN_TOKEN` | — | exigido pelo painel; opcional no `.env`: o primeiro acesso ao painel cria um |
| `API_TOKEN` | — | exigido por toda a `/api`, menos `/api/health` e a documentação; sem ele, ela não responde |
| `TMDB_API_KEY` | — | ativa o enriquecimento |
| `TMDB_LANGUAGE` | `pt-BR` | idioma de títulos, sinopses e gêneros |
| `TMDB_RPS` | `8` | requisições por segundo à TMDB |
| `TMDB_STALE_DAYS` | `30` | revalida a nota das obras casadas |
| `TMDB_RETRY_DAYS` | `14` | tenta de novo o que não casou (`0` desliga) |
| `TMDB_MIN_VOTES` | `150` | abaixo disso a nota não é exibida |
| `DEBRID_PROVIDER` / `TORBOX_API_KEY` | — | provedor de debrid e o token dele |
| `HTTP_TIMEOUT_MS` / `HTTP_RETRIES` | `20000` / `3` | cliente HTTP dos trackers |
| `LOG_LEVEL` | `info` | o que o terminal mostra: `debug`, `info`, `warn` ou `error` |

## Acesso

Só `/api/health` e a documentação em `/api/docs` são abertas. O painel exige o
`ADMIN_TOKEN`; o catálogo, a busca e o debrid exigem o `API_TOKEN`. Sem
`ADMIN_TOKEN`, o primeiro acesso ao painel cria um (precisa de `SECRETS_KEY`).

Para expor o servidor na internet, coloque um proxy com HTTPS na frente.
