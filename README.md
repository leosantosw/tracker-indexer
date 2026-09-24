<div align="center">

<img src="src/ui/assets/logo.png" alt="tracker-indexer" width="96" height="96">

# tracker-indexer

**Indexa trackers de torrent, casa cada título com a TMDB e entrega um catálogo
de filmes e séries pronto para um app de TV.**

![Node](https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white)
![Fastify](https://img.shields.io/badge/fastify-5-000000?logo=fastify&logoColor=white)
![SQLite](https://img.shields.io/badge/sqlite-node%3Asqlite-003B57?logo=sqlite&logoColor=white)

[Começando](#começando) ·
[Como funciona](#como-funciona) ·
[API](#api) ·
[Configuração](#configuração) ·
[Documentação](#documentação)

</div>

---

## Recursos

- **Sincronização incremental** de trackers por API JSON ou por HTML, com
  throttle, retry e cancelamento.
- **Classificador de releases:** filtra o que não é filme ou série e extrai
  título, ano, resolução, codec, áudio e HDR.
- **Enriquecimento pela TMDB:** capa, backdrop, sinopse, gêneros, nota e
  trailer, com uma regra de match conservadora: na dúvida, fica sem capa.
- **API REST para TV:** listagem enxuta e detalhe completo, gzip/brotli, ETag e
  categorias prontas (novidades, melhores notas, gêneros).
- **Debrid (TorBox):** pede o vídeo e devolve um link direto, sem expor o token
  da conta.
- **Painel web em `/admin`:** jobs, log ao vivo, agendamento, configuração por
  tracker e segredos cifrados com AES-256-GCM.
- **Poucas dependências:** Fastify e cheerio, com o SQLite embutido do Node.
  Sem build nem banco externo.

## Começando

Requer **Node.js 22+**, por causa do `node:sqlite`.

```bash
git clone https://github.com/leosantosw/tracker-indexer.git
cd tracker-indexer
npm install

cp .env.example .env
npm run keygen            # cole a SECRETS_KEY gerada no .env

npm run sync              # indexa os trackers e enriquece pela TMDB
npm run serve             # API em :3000/api, painel em :3000/admin
```

Para ter capa, sinopse e nota, cadastre uma `TMDB_API_KEY` (gratuita em
[themoviedb.org](https://www.themoviedb.org/settings/api)) no `.env` ou no
painel. Sem ela, o sync funciona normalmente e só pula o enriquecimento.

### Comandos

| Comando | O que faz |
|---|---|
| `npm run sync` | sincroniza os trackers ativos e, no fim, enriquece pela TMDB |
| `npm run enrich` | só o enriquecimento, sem tocar nos trackers |
| `npm run serve` | sobe a API, o Swagger e o painel |
| `npm run stats` | itens por tracker e resultado do match |
| `npm run check-source <tracker>` | confere a 1ª página de um tracker, sem gravar |
| `npm run query "SELECT ..."` | consulta o banco (somente leitura) |
| `npm run keygen` | gera uma `SECRETS_KEY` |
| `npm test` | roda a suíte de testes |

## Como funciona

```
 trackers ──► sync ──► classificador ──► item ──► regras ──► enrich ──► work ──► API
 (JSON/HTML)   paginação   aceita/rejeita    (torrent)  requireYear   TMDB     (obra)   /api
               throttle    título, ano,                 dedupe        match
               retry       resolução...
```

A base tem **duas entidades**, que não se misturam:

| | O que é | De onde vem |
|---|---|---|
| **obra** (`work`) | o filme ou a série: capa, sinopse, nota | TMDB |
| **torrent** (`item`) | uma cópia dela: seeders, tamanho, resolução | tracker |

Os quatro releases de *Divertida Mente* são **uma** obra com quatro cópias. A
TMDB é consultada uma vez por obra, e até o fracasso fica gravado: o que não
casou não custa uma requisição a cada execução.

Os detalhes estão em [docs/arquitetura.md](docs/arquitetura.md).

## API

Com o `serve` no ar, a referência navegável fica em
**<http://localhost:3000/api/docs>** (Swagger UI), e o OpenAPI 3.1 cru em
`/api/docs/json`.

```
GET /api/categories?preview=12    linhas da tela inicial, com os primeiros filmes
GET /api/movies?page=1&limit=50   grade de filmes (só o cartão)
GET /api/movies/:id               um filme completo, com as cópias
GET /api/series                   grade de séries
GET /api/series/:id               uma série, com os episódios

POST   /api/debrid/torrents       { "hash": "..." }  pede o vídeo ao debrid
GET    /api/debrid/torrents/:hash acompanha o download
DELETE /api/debrid/torrents/:hash remove da conta
```

```jsonc
// GET /api/movies
{
  "movies": [
    {
      "id": 362,
      "title": "Interestelar",
      "year": 2014,
      "poster": "https://image.tmdb.org/t/p/w185/...jpg",
      "backdrop": "https://image.tmdb.org/t/p/w780/...jpg",
      "rating": 8.487
    }
  ],
  "page": 1, "limit": 50, "total": 773, "pages": 16
}
```

Pensada para TV: são duas requisições por tela, cada uma do tamanho da tela. A
página de 50 filmes pesa **~3,6 KB** comprimida, e recarregar sem mudança
devolve um `304` vazio.

A referência completa está em [docs/api.md](docs/api.md).

## Configuração

A configuração vem em camadas: **padrões do código → `.env` → painel**. O que
for salvo no painel vale mais, e os segredos vão cifrados para o banco.

| Variável | Padrão | |
|---|---|---|
| `DB_FILE` | `./data/catalog.db` | arquivo do SQLite |
| `API_PORT` / `API_HOST` | `3000` / `0.0.0.0` | onde a API escuta |
| `SECRETS_KEY` | — | chave AES dos segredos salvos pelo painel (`npm run keygen`) |
| `ADMIN_TOKEN` | — | protege o painel; sem ele, só localhost |
| `API_TOKEN` | — | protege as rotas de debrid; sem ele, só localhost |
| `TMDB_API_KEY` | — | ativa o enriquecimento |
| `TMDB_LANGUAGE` | `pt-BR` | idioma de títulos, sinopses e gêneros |
| `TMDB_RPS` | `8` | requisições por segundo à TMDB |
| `TMDB_STALE_DAYS` | `30` | revalida a nota das obras casadas |
| `TMDB_RETRY_DAYS` | `14` | tenta de novo o que não casou (`0` desliga) |
| `TMDB_MIN_VOTES` | `150` | abaixo disso a nota não é exibida |
| `DEBRID_PROVIDER` / `TORBOX_API_KEY` | — | provedor de debrid e o token dele |
| `HTTP_TIMEOUT_MS` / `HTTP_RETRIES` | `20000` / `3` | cliente HTTP dos trackers |

> [!IMPORTANT]
> Sem `ADMIN_TOKEN` e `API_TOKEN`, o painel e o debrid só respondem para
> localhost. Para expor o servidor, defina os dois e coloque um proxy com HTTPS
> na frente.

## Painel

Em **<http://localhost:3000/admin>** dá para:

- atualizar o catálogo, buscar capas e cancelar uma execução em andamento;
- acompanhar cada execução por etapas, com progresso e avisos; os logs técnicos ficam a um clique;
- ligar, desligar, **testar** e ajustar cada tracker;
- agendar atualizações diárias ou por intervalo;
- cadastrar chaves e tokens, cifrados no banco.

O guia completo está em [docs/painel.md](docs/painel.md).

## Adicionando um tracker

Tracker HTML vira uma declaração de seletores:

```js
module.exports = defineHtmlSource({
  name: 'meu-tracker',
  rps: 1,
  pages: 10,
  stopAfterQuietPages: 2,
  rules: { requireYear: true },

  list: {
    url: (page) => `https://exemplo.com/pagina/${page}/`,
    rows: 'a.cover-link',
    fields: { url: '@href', title: 'article@data-title' },
  },
  detail: {
    fields: { magnet: 'a[href^="magnet:"]@href' },
  },
});
```

Depois, é só registrar o tracker em `src/sources/index.js` e conferir com
`npm run check-source meu-tracker`. Tracker com API JSON segue o contrato
`fetchPage` / `toItem`, descrito em
[docs/arquitetura.md](docs/arquitetura.md#adicionando-um-tracker).

## Documentação

| Guia | Conteúdo |
|---|---|
| [docs/api.md](docs/api.md) | rotas, payloads, categorias, ordenação, debrid e erros |
| [docs/arquitetura.md](docs/arquitetura.md) | sync, enriquecimento, classificador, trackers, estrutura e limitações |
| [docs/painel.md](docs/painel.md) | painel, agendamento, segredos e a API do admin |
| [docs/trackers-candidatos.md](docs/trackers-candidatos.md) | sites independentes que valem virar tracker |

## Contribuindo

1. Faça um fork e crie uma branch.
2. Rode `npm test` antes de abrir o PR.
3. Para um tracker novo, inclua a saída do `npm run check-source`.

## Aviso

Este projeto indexa **metadados públicos** de torrents. Ele não hospeda nem
distribui nenhum arquivo. Respeite os direitos autorais e os termos de uso dos
sites indexados.
