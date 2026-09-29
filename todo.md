# TODO

## Corrigir primeiro

- [ ] **Setup do admin aberto** — `src/api/admin/routes/setup.js:8` aceita `POST /setup` sem auth enquanto não há token, e o servidor escuta em `0.0.0.0` (`src/config.js:23`). Permitir setup só de loopback (ou código de uso único impresso no stdout) e exigir token com tamanho mínimo (~24).
- [ ] **Enrich cancelado deixa leads velhos** — `repo.refreshLeads()` (`src/job/pipeline.js:42`) só roda se o enrich terminar sem erro; cancelado ou com falha da TMDB, obras recém-casadas com o mesmo `tmdb_id` aparecem duplicadas. Chamar `refreshLeads` num `finally`.
- [ ] **SSRF via HTML do tracker** — `src/sources/html/defineHtmlSource.js:68` busca `card.url` vindo da página sem checar o domínio. Exigir mesma origem da listagem.
- [ ] **Dois syncs simultâneos** — o runner só é single-flight dentro do `serve`; `npm run sync` pela CLI roda junto com o agendado. Lock no banco (linha com pid + heartbeat).
- [ ] **Erros engolidos** — `src/debrid/cacheStatus.js:41,51`, `src/debrid/torbox/index.js:27`, `src/sources/tmdb/index.js:63`, `src/ui/lib/api.js:15`. Token TorBox revogado passa despercebido. Capturar só o erro esperado, logar o resto, repassar abort.

## Arquitetura

- [ ] **Busca pesada e síncrona** — `src/db/search.js` faz `LIKE` com `fold()` em todas as obras; `/search/genres` repete 12 vezes; `node:sqlite` trava o event loop (inclusive SSE). FTS5 ou coluna `search_text` normalizada, atualizada no `saveWork`.
- [ ] **Escritas sem transação** — `saveWork` (`src/db/works.js`) e o match manual (`src/api/admin/routes/manualMatch.js:48-50`). Mover o match manual para um serviço em `src/job/` e envolver em `transaction()`.
- [ ] **Migrations sem versão** — `src/db/index.js` decide pela existência de coluna. Lista ordenada com `PRAGMA user_version`, cada uma em transação.
- [ ] **Retry HTTP** — `src/lib/http.js` repete qualquer falha (até parse de JSON), ignora `Retry-After` do 429, `throttle` quebra com requisições simultâneas; TorBox sem retry.
- [ ] **Token na query string** — `src/api/auth.js:19` aceita `?token` em todas as rotas. Aceitar só na rota SSE.
- [ ] **Limpeza**
  - [ ] `bind` (`src/db/works.js:176`) e `withoutUnused` (`src/db/search.js:50`) são a mesma função.
  - [ ] `sleep` duplicado em `src/lib/http.js` e `src/debrid/torbox/index.js`.
  - [ ] `now()` de `src/db/items.js` para `src/lib/`.
  - [ ] `WORK_ORDERS` sem uso (`src/api/public/schemas.js:19`); índices `ix_item_seeders` e `ix_item_created` sem query.
  - [ ] Dividir `src/db/works.js` em catálogo e fila do enrich.
- [ ] **Buracos de teste** — `src/lib/http.js`, `src/db/search.js`, parsers comando/torrentDosFilmes/torrentsCsv; rotas `/api/search`, `/api/series*`, `/api/categories`, `/api/admin/setup`.

## Funcionalidades

### Rápidas

- [ ] **Temporadas/episódios no detalhe da série** — agrupar em `seasons[].episodes[]` (`toWorkDetail` em `src/api/public/dto.js`). Resolve também as cópias sem paginação.
- [ ] **Filtros nas listas** — idioma (dublado/dual), resolução mínima, ano, gênero (`LIST_QUERY` + `listWorks`).
- [ ] **Categorias novas** — "Novos esta semana", "Em 4K", "Dublados", "Disponível instantâneo" (cache do debrid).
- [ ] **Alerta de tracker sem itens** — hoje "template mudou?" só vai para o log. Uma linha por tracker, sobrescrita, exibida em `src/ui/views/alerts.js`.
- [ ] **Tracker BluDV** — irmão do torrentdosfilmes (`docs/trackers-candidatos.md`).

### Médias

- [ ] Real-Debrid e AllDebrid em `src/debrid/`.
- [ ] Dedupe por qualidade em vez de seeders (720p ganhando de 1080p).
- [ ] Esconder torrents mortos e limpar obras órfãs.

### Apostas maiores

- [ ] Addon Stremio (precisa guardar `imdb_id` no enrich).
- [ ] "Similares" e "Em alta" da TMDB, filtrados pelo catálogo.
- [ ] Metadados de episódio (nome, still, data).
- [ ] Navegador do catálogo no painel.

## Docs

- [ ] `docs/arquitetura.md` diz que séries do redes-torrents estão fora "por enquanto", mas o código já tem `content: 'both'`.
