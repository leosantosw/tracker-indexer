# tracker-indexer

Job que sincroniza torrents do [Torrents CSV](https://torrents-csv.com) para um
SQLite, normaliza os títulos e expõe uma API de consulta.

Requer **Node 22+** (usa o `node:sqlite` embutido). Dependências: Fastify e os
plugins de Swagger.

## Rodando

```bash
npm install
npm run sync     # sincroniza os trackers e enriquece pela TMDB
npm run enrich   # só o enriquecimento, sem tocar nos trackers
npm run stats    # quantos itens por tracker e o resultado do match
npm run serve    # API em http://localhost:3000
npm test
```

Configuração opcional via `.env` (veja `.env.example`). Para capa, sinopse e
nota, ponha uma `TMDB_API_KEY` — gratuita em themoviedb.org → Settings → API.
Sem ela o `sync` roda igual, só pula o enriquecimento.

## API

Com a API no ar, a referência completa e navegável fica em
**<http://localhost:3000/docs>** (Swagger UI, com _try it out_). O OpenAPI 3.1
cru está em `/docs/json` — serve para gerar cliente:

```bash
curl -s http://localhost:3000/docs/json > openapi.json
```

**A API tem duas entidades, e elas não se misturam:**

| | O quê | De onde vem |
|---|---|---|
| **obra** | o filme ou a série: capa, sinopse, nota | TMDB |
| **torrent** | uma cópia dela: seeders, tamanho, resolução | tracker |

```
GET /health
GET /stats

GET /movies              lista filmes      (uma linha por filme)
GET /movies/:id          um filme
GET /movies/:id/torrents as cópias dele

GET /series              lista séries      (uma linha por série)
GET /series/:id          uma série
GET /series/:id/torrents as cópias dela
```

O `:id` é o id da **obra**, não do torrent. O tipo vem da rota: `/series/:id`
com id de filme dá 404, e nenhum payload traz `type`.

Os quatro releases de *Divertida Mente* são **um** item em `/movies` e quatro em
`/movies/:id/torrents`. Para série, a obra é a série inteira e as cópias são os
episódios — `season` e `episode` ficam na cópia, onde pertencem.

A listagem **não tem filtros**, só paginação:

| Parâmetro | Padrão | |
|---|---|---|
| `page` | `1` | página, a partir de 1 |
| `limit` | `50` | itens por página, máximo 200 |

A ordem é fixa, nesta prioridade:

1. **ter nota** — nota qualquer, não nota alta: 5.1 apurado ganha de nota nenhuma;
2. **ano** mais recente primeiro;
3. **maior nota** dentro do ano.

Obra sem nota apurada cai para o fim da lista inteira, não só do próprio ano. Na
prática isso empurra o lançamento recente para baixo: filme de 2026 ainda não
teve tempo de juntar 150 votos.

E só entra obra que casou com a TMDB: sem capa, sem sinopse e sem nota não há o
que listar.

A resposta se descreve:

```json
{
  "movies": [ ... ],
  "page": 1,
  "limit": 50,
  "total": 773,
  "pages": 16
}
```

Todo critério de ordenação termina em `id`, então paginar não repete nem pula
obra — sem esse desempate, itens de mesmo ano e mesma nota mudariam de posição
entre duas consultas.

### Nota só com votação suficiente

`rating` vem **nulo abaixo de `TMDB_MIN_VOTES` votos** (150 por padrão). Nota 8
apurada em 4 votos não é nota, é ruído — e era o que colocava filme desconhecido
no topo. A mesma regra vale para exibir e para ordenar.

`votes` continua no payload mesmo com a nota nula: é ele que explica o porquê.
Hoje isso silencia **82 das 805 obras** visíveis (10%) — a cauda obscura, quase
toda de lançamento recente.

A listagem e o detalhe não carregam a mesma coisa: **trailer e contagem de
cópias só na obra aberta**, não repetidos em cada linha.

```json
// GET /movies/362
{
  "id": 362,
  "title": "Interestelar",
  "year": 2014,
  "genres": ["Aventura", "Drama", "Ficção científica"],
  "poster": "https://image.tmdb.org/t/p/w342/tR1XVa5bxgdh2bRw2u0DzrgkO2l.jpg",
  "backdrop": "https://image.tmdb.org/t/p/w780/8sNiAPPYU14PUepFNeSNGUTiHW.jpg",
  "overview": "As reservas naturais da Terra estão chegando ao fim...",
  "rating": 8.487,
  "votes": 41140,

  // daqui para baixo, só no detalhe:
  "trailer": "https://www.youtube.com/watch?v=i6avfCqKcQo",
  "torrents": 1,
  "bestSeeders": 4
}
```

```json
// GET /movies/362/torrents
{
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
      "infohash": "ac3ee9395349ad9a0b6ef13e1520511a6b9ee2b2",
      "source": "torrents-csv",
      "createdAt": "2026-09-14T07:10:30.000Z",
      "updatedAt": "2026-09-14T07:11:36.000Z"
    }
  ]
}
```

O payload é enxuto de propósito. `release_date`, `last_added`, `tmdb_id` e
`status` existem no banco e são usados para ordenar e filtrar, mas **não saem na
resposta**.

A obra que não casou com a TMDB some da listagem, mas continua acessível por
`/movies/:id` e `/movies/:id/torrents` — some da vitrine, não do acervo.

`size` é o `size_bytes` do banco formatado em GB (acima de 1 GB) ou MB.

Consulta direta ao banco, sem subir nada:

```bash
npm run query "SELECT name, seeders FROM item ORDER BY created_at DESC LIMIT 10"
```

## Como a sincronização funciona

A API do tracker tem um endpoint só:

```
GET /service/search?q=<termo>&after=<cursor>  ->  { torrents: [...], next: <id|null> }
```

Três consequências que moldam o job:

- **`q` é obrigatório** (mínimo 3 caracteres) e não existe rota de "mais
  recentes". A cobertura vem da lista de termos em `src/sources/torrentsCsv.js`,
  que é também o recorte pt-br. A busca é AND entre os termos, então termo
  composto é subconjunto do simples — `dublado 1080p` nunca traz nada que
  `dublado` já não tenha.
- **O resultado vem ordenado por seeders, nunca por data.** Ordenar por data é
  trabalho do nosso banco.
- **O `id` da resposta é o rank por seeders, não uma chave de inserção.** Ele
  muda quando a base do tracker é reconstruída, então serve de cursor dentro de
  uma run e nada além disso.

Cada run pagina todo termo até o fim. Parece desperdício, mas não é: como a
ordenação é por seeders, **um torrent novo com poucos seeders nasce no fim da
lista** — parar antes seria nunca alcançar justamente ele.

Duplicata não é problema: a chave `(source, source_id)` faz o upsert ser
idempotente, e `created_at` nunca é sobrescrito. Medido no serviço real: 1ª run
1286 itens, 2ª run 0 novos, sem duplicatas.

Um source pode definir `stopAfterQuietPages: N` para desistir de um termo após
N páginas seguidas sem novidade. Vale onde cada requisição é cara — um tracker
privado com limite diário — e não aqui.

### Regras por tracker

Um source pode declarar regras que valem **só para o catálogo dele** — o que
limpa um tracker não toca nos outros:

```js
rules: { requireYear: true, dedupe: 'seeders' },
```

| Regra | O que faz |
|---|---|
| `requireYear` | apaga item sem ano — sem ele não dá para casar com catálogo externo |
| `dedupe: 'seeders'` | da mesma obra fica só a cópia mais semeada |

Duplicata é mesma `(type, title, year, season, episode)`, então episódio de
série não atropela episódio, e remake não atropela original (`Cinderela` de
1950 e de 2015 convivem). Empate de seeders fica com o item mais antigo, para a
escolha não oscilar entre runs.

As regras rodam **no fim da run, não no insert**: duplicata chega por páginas e
termos diferentes, e só dá para enxergá-la com a base inteira em mãos. Como
efeito colateral, elas também limpam o que entrou antes de a regra existir.

No `torrents-csv`, as duas ligadas levam **1286 itens para 995** (−196 sem ano,
−95 duplicados, 22,6%).

**A dedup escolhe por seeders, não por qualidade.** Um 720p com 7 seeders ganha
do 1080p com 3 — foi o que aconteceu com `Ainda Estou Aqui` e `Divertida Mente`
na base atual. Se o critério desejado for resolução, a ordenação fica em
`DEDUPE_BY_SEEDERS`, em `db/repo.js`.

## Enriquecimento (TMDB)

Segundo passo do catálogo: casa cada obra com a [TMDB](https://themoviedb.org)
e guarda capa, sinopse e nota. Roda no fim do `sync` e também sozinho, em
`npm run enrich`.

**A unidade é a obra, não o torrent.** Os quatro releases de *Divertida Mente*
são uma consulta só e apontam para a mesma linha de `work`:

```
item                                        work
──────────────────────────────────────      ───────────────────────────────
Divertida Mente (2015) 720p BluRay   ─┐
Divertida Mente (2015) 1080p BluRay  ─┼──→  movie | Divertida Mente | 2015
Divertida Mente (2015) 720p          ─┘     tmdb_id 150540, nota 7.9
```

Para série isso cai certo sozinho: todos os episódios compartilham
`(type, title, year)`, então a linha de `work` é **a série** — que é
exatamente o que `/search/tv` devolve.

### Por que é um passo separado

- **Depois das regras do tracker.** Elas apagam ~23% do catálogo; consultar
  antes seria gastar quase um quarto das chamadas em item que já vai embora.
- **Falhar não derruba o sync.** Nesse ponto o dado do tracker já está gravado.
  Torrent que some não volta; capa volta na próxima run.
- **Reprocessável.** Mudou a regra de match ou quer atualizar as notas? Roda o
  `enrich` sem varrer tracker nenhum.

### A regra de match

Capa errada é pior que capa nenhuma, então na dúvida o item fica sem enriquecer.

| Situação | Decisão |
|---|---|
| Tem ano | aceita o resultado cujo ano bate ±1; entre vários, o mais popular |
| Sem ano, título exato e único | aceita |
| Sem ano, título exato e empatado | aceita só se o 1º for 2× mais popular que o 2º |
| Coletânea (`Trilogia`, `Saga`…) | nem consulta — não existe obra correspondente |
| Nada convence | fica `ambiguous`, sem capa |

O ±1 existe porque a TMDB guarda a estreia original e o release brasileiro
costuma usar a estreia daqui, que atrasa. O ano **não** vai na query: o filtro
da TMDB é exato e cortaria justamente esse caso.

### O que torna barato rodar sempre

O fracasso também é gravado. É o `status` que impede de perguntar por
`Hexalogia Star Wars` em toda execução, para sempre:

| `status` | Significado | Reconsultado? |
|---|---|---|
| `ok` | casou | sim, a cada `TMDB_STALE_DAYS` (nota muda) |
| `not_found` | a TMDB não conhece | não |
| `ambiguous` | achou candidatos, nenhum confiável | não |
| `skipped` | coletânea, nem foi consultado | não |

### Quantas requisições custa

| Caso | Chamadas |
|---|---|
| Obra que casou | **2** — a busca, mais o detalhe de onde sai o trailer |
| Obra que não casou | **1** — só a busca |
| Coletânea | **0** — o regex corta antes de qualquer requisição |
| Dicionário de gêneros | **2 por execução**, não por obra |

Quase tudo vem numa resposta só: capa, backdrop, gêneros, data, nota e sinopse
saem da mesma busca. **O trailer é a única exceção** — a busca não traz vídeo
nenhum. Por isso ele é buscado depois do match (obra que não casou não paga) e
**uma vez só por obra**: `trailer_checked` marca quem já foi procurado, achando
ou não, e a revalidação de nota nunca mais paga a segunda chamada. Falha ali
devolve `null` em vez de invalidar um match que já deu certo.

Na primeira execução são ~983 obras (~2 min a 8 rps, ou ~3,5 min contando os
trailers). Depois, só as novas.

`npm run stats` mostra a distribuição por `status`.

O piso de `TMDB_MIN_VOTES` resolve o caso clássico: sem ele, nota 10 apurada em
1 voto vencia *Interestelar* com 41 mil.

### Imagens e trailer

São duas imagens, as duas com URL direta do CDN da TMDB — sem chave e sem
limite:

| Campo | O quê | Tamanho |
|---|---|---|
| `poster` | capa vertical, para a grade | `w342` |
| `backdrop` | horizontal, para banner e fundo | `w780` |

O banco guarda só o caminho (`/abc.jpg`); quem monta a URL é o DTO, com
`POSTER_BASE` e `BACKDROP_BASE` em `api/server.js`. Trocar `w342` por `w500` é
uma linha, sem reprocessar nada. `backdrop` é nulo com mais frequência que
`poster` — 803 contra 871 na base atual.

O `trailer` é link do YouTube, montado a partir do id do vídeo. Entre as
dezenas de vídeos que a TMDB devolve (clipe, bastidor, featurette), a escolha é
por pontuação: trailer vale mais que teaser, dublado mais que legendado, e
oficial desempata. Abaixo de teaser nada serve.

**Não baixe as imagens.** Hospedar seria ~50 MB em `w342` para as 871 obras,
com o custo de manter e servir — e o CDN da TMDB faz de graça e mais rápido.

### Gênero

`genres` vem da TMDB, no idioma de `TMDB_LANGUAGE`. A busca devolve só ids
numéricos, então o enrich carrega o dicionário de gêneros **uma vez por
execução e por tipo** — são duas requisições na run inteira, não uma por obra.

No banco é uma coluna `TEXT` (`"Terror, Thriller"`), mesma convenção de `audio`
e `hdr` em `item`. Sem filtro por gênero na API, uma coluna basta e evita tabela
de ligação. Na resposta vira array.

### Capa

A tabela guarda `poster_path` (`/abc.jpg`), não a URL. Quem monta é o DTO, em
`api/server.js`, com `POSTER_BASE`. Trocar `w342` por `w500` é uma linha — sem
reprocessar nada.

## Classificador

`src/lib/classifier/` recebe o nome cru e decide se entra no catálogo, além de
extrair os metadados e normalizar o título.

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

**O filtro é lista de permissão, não de bloqueio.** Em vez de enumerar o que não
queremos (exe, zip, rar, jogo, software), basta exigir marca de filme:
resolução, fonte, codec, container, áudio ou temporada. O que não tem nenhuma
delas não é filme — e isso derruba Windows, Corel e FIFA sozinho, sem lista.

A única exceção que precisa de bloqueio explícito é captura de cinema
(CAM, TS, TC, SCR): ela *tem* as marcas (`1080p TC`), mas a qualidade não presta.

Medido na base real: 1522 itens brutos → 1286 aceitos, com **zero** software,
jogo ou arquivo passando.

### Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `index.js` | cadeia de classificadores |
| `normalize.js` | entities HTML, acentos, busca nos dicionários |
| `tags.js` | dicionários de marcas (resolução, fonte, codec, áudio, HDR) |
| `title.js` | limpeza e extração do título |
| `release.js` | monta o resultado |
| `filter.js` | aceita ou rejeita |

Adicionar um classificador é criar o arquivo e acrescentar uma linha em
`index.js`. Contrato:

```js
{ name, classify(text, raw, result) }  // -> campos a mesclar; `rejected` corta a cadeia
```

### Normalização do título

O `name` gravado é o título normalizado; o original fica em `raw_name` — assim
dá para reprocessar a base sem sincronizar de novo.

```
www.UIndex.org  -  The Warning Live (2025) 2160p 4K WEB 5.1-WORLD
  -> The Warning Live From Auditorio Nacional CDMX (2025) 2160p WEB

[Darkmahou.io] One Piece - 1168 [1080p HEVC][PT-BR].mkv
  -> One Piece E1168 1080p HEVC
```

## redes-torrents

Segundo tracker, de formato oposto ao primeiro: **catálogo HTML, sem API**.

| | torrents-csv | redes-torrents |
|---|---|---|
| Formato | JSON | HTML |
| Varredura | por termo de busca | por página (`/pagina/N/`) |
| Listagem de recentes | não existe | existe, mais novo primeiro |
| Magnet | vem na busca | só na página do título |
| seeders | sim | **não publica** |
| infohash | hex | **base32** |

Três consequências:

**O `stopAfterQuietPages` finalmente serve.** Como o site lista do mais novo
para o mais antigo, bateu numa página sem novidade dá para parar. No
torrents-csv isso seria errado — ele ordena por seeders, e torrent novo nasce no
fim da lista.

**Cada título custa uma requisição própria:** 1 listagem + 20 detalhes = 21
requisições por 20 itens. Com `rps: 1`, uma varredura das 10 páginas iniciais
leva ~4 min. É o oposto do torrents-csv, onde uma resposta traz a página
inteira já pronta.

**Sem seeders, `dedupe: 'seeders'` não pode ser ligado** — não há o que
desempatar. Como as regras são declaradas por tracker, isso não afeta o
torrents-csv.

### O truque do nome

O `dn=` do magnet traz as marcas de release **antes** do nome, e o classificador
corta o título no primeiro marcador — o resultado seria um título como
`WEB-DL 1080P MKV`. Por isso o nome limpo, que a listagem publica em
`data-title`, entra na frente:

```
"Aposta de Alto Risco" + ". " + "SITE.COM-.WEB-DL.1080P.-.Aposta+de+Alto+Risco.2026..."
  -> title: "Aposta de Alto Risco", year: 2026, 1080p, WEB-DL, x264
```

Assim não é preciso raspar metadado nenhum do HTML: só o magnet e o tamanho.

### Fragilidade e cortesia

A extração é por regex, sem dependência nova. Se o template mudar, o source
passa a indexar zero — por isso ele **avisa no log** quando uma página rende
cartões mas nenhum magnet. É também o sintoma de desafio do Cloudflare: HTTP
200, HTML grande, zero conteúdo útil.

O site fica atrás de Cloudflare em modo CDN, sem desafio de JS: o `fetch` do
Node passa direto. Ainda assim, `rps: 1`, User-Agent de navegador e nenhuma
requisição em paralelo — o `robots.txt` libera crawler geral, mas não declara
`crawl-delay`.

Série está de fora por enquanto: o site publica **um torrent por episódio**, e
isso ainda não tem desenho no catálogo. O filtro usa o `data-tipo` do site mais
a presença de "Temporada" no título.

## Adicionando um tracker

Crie o arquivo e acrescente uma linha em `src/sources/index.js`:

```js
module.exports = {
  name: 'meu-tracker',
  rps: 2,
  terms: ['dublado'],                     // varredura por busca...
  pages: 10,                              // ...ou por página, um dos dois
  stopAfterQuietPages: 3,                 // opcional: requisição cara
  rules: { requireYear: true },           // opcional: ver "Regras por tracker"

  create({ getJson, getText }) {
    return {
      async fetchPage({ term, cursor, log }) {
        // -> { items, nextCursor }
      },
      toItem(raw) {
        // -> { sourceId, infohash, name, sizeBytes, createdUnix, seeders, leechers }
      },
    };
  },
};
```

Um source declara `terms` (varre por busca) ou `pages` (varre por página). O
`fetchPage` é `async` e pode fazer quantas requisições precisar antes de
devolver — foi assim que o redes-torrents buscou o magnet de cada título sem
mudar o contrato.

O resto da aplicação não muda.

## Documentação da API

O Swagger não é escrito à mão: ele sai dos mesmos schemas que validam a
requisição e serializam a resposta, em `src/api/schemas.js`. Um campo que não
esteja no schema não aparece na documentação **e não sai na resposta** — os dois
não têm como divergir.

| Arquivo | Responsabilidade |
|---|---|
| `api/schemas.js` | schemas JSON: filtros, obras, cópias e respostas |
| `api/docs.js` | metadados do OpenAPI e a página em `/docs` |
| `api/server.js` | rotas, ligando cada uma ao seu schema |

São quatro schemas, dois por entidade: `Movie`/`Series` para a obra e
`MovieTorrent`/`SeriesTorrent` para a cópia — cada par sai de uma função só, e
a de série apenas acrescenta `season` e `episode`. Todo campo é `required`: o
que não se sabe vai como `null`, nunca ausente, então o cliente não precisa
testar existência de chave.

Acrescentar um filtro é uma linha em `LIST_QUERY`, mais o `WHERE` em
`db/repo.js`. A documentação acompanha sozinha.

## Estrutura

```
src/
├─ index.js               CLI
├─ config.js              env com defaults
├─ http.js                fetch com throttle e retry
├─ api/
│  ├─ server.js           rotas
│  ├─ schemas.js          schemas JSON (validação + serialização + Swagger)
│  └─ docs.js             Swagger UI em /docs
├─ job/
│  ├─ sync.js             paginação e critério de parada
│  └─ enrich.js           casa cada obra com a TMDB
├─ db/
│  ├─ index.js            conexão, schema, migrations e transação
│  ├─ repo.js             fachada sobre as duas entidades
│  ├─ items.js            tabela item: gravação e regras por tracker
│  └─ works.js            tabela work: obra, enriquecimento e leituras da API
├─ lib/classifier/        ver acima
└─ sources/
   ├─ index.js            registry
   ├─ torrentsCsv.js      API JSON
   ├─ redesTorrents/
   │  ├─ index.js         catálogo HTML
   │  └─ parse.js         extração, sem rede (testável)
   └─ tmdb.js             busca e regra de match
```

## Limitações conhecidas

- **Migration é uma lista, não um framework.** `CREATE TABLE IF NOT EXISTS` não
  altera tabela existente, então coluna nova entra pelo array `MIGRATIONS` em
  `db/index.js`: cada entrada roda no máximo uma vez, e quem decide é o
  `PRAGMA table_info`. Uma entrada pode trazer `reset: 'UPDATE work SET
  checked_at = 0'` para invalidar o cache e deixar o próximo `enrich` preencher
  a coluna — foi assim que `release_date` entrou. Não há rollback nem ordem
  versionada; para mudança grande, apagar o banco e ressincronizar continua
  sendo o caminho.
- **`work` órfã não é limpa.** Quando as regras do tracker apagam itens, a obra
  fica na tabela. Ela some das rotas (o JOIN com `item` é interno), mas continua
  no banco servindo de cache: se o release voltar, a capa já está lá.
- **`/movies` depende do enrich ter rodado.** É o enrich que cria a linha em
  `work`, inclusive para o que não casou. Sem `TMDB_API_KEY` configurada na
  primeira sincronização, as rotas do catálogo vêm vazias.
- **`:id/torrents` não pagina.** Hoje o máximo observado é 3 cópias por obra.
- **As regras de tracker apagam de verdade.** `requireYear` e `dedupe` fazem
  `DELETE`; o item volta no próximo sync se ainda existir no tracker, mas o
  `created_at` dele recomeça.
- **`updated_at` avança a cada sync**, mesmo quando nada mudou no item — ele
  marca "última vez que foi visto", não "última vez que mudou".
- **Cobertura limitada aos termos.** Um release dublado que não case com nenhum
  dos 11 termos é invisível para o job.
