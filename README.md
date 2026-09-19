# tracker-indexer

Job que sincroniza torrents do [Torrents CSV](https://torrents-csv.com) para um
SQLite, normaliza os títulos e expõe uma API de consulta.

Requer **Node 22+** (usa o `node:sqlite` embutido). Dependências: Fastify e os
plugins de Swagger, compressão e ETag.

## Rodando

```bash
npm install
npm run sync     # sincroniza os trackers e enriquece pela TMDB
npm run enrich   # só o enriquecimento, sem tocar nos trackers
npm run stats    # quantos itens por tracker e o resultado do match
npm run serve    # API em http://localhost:3000/api, painel em /admin
npm run keygen   # gera a SECRETS_KEY que cifra os segredos salvos pelo painel
npm test
```

Configuração opcional via `.env` (veja `.env.example`) ou pelo painel. Para
capa, sinopse e nota, cadastre uma `TMDB_API_KEY` — gratuita em themoviedb.org →
Settings → API — no `.env` ou em *Configurações → Segredos*. Sem ela o `sync`
roda igual, só pula o enriquecimento.

## API

Com a API no ar, a referência completa e navegável fica em
**<http://localhost:3000/api/docs>** (Swagger UI, com _try it out_). O OpenAPI 3.1
cru está em `/api/docs/json` — serve para gerar cliente:

```bash
curl -s http://localhost:3000/api/docs/json > openapi.json
```

**A API tem duas entidades, e elas não se misturam:**

| | O quê | De onde vem |
|---|---|---|
| **obra** | o filme ou a série: capa, sinopse, nota | TMDB |
| **torrent** | uma cópia dela: seeders, tamanho, resolução | tracker |

```
GET /api/health
GET /api/stats

GET /api/movies        lista filmes    (cartão da grade, uma linha por filme)
GET /api/movies/:id    um filme        (tudo, com as cópias dentro)

GET /api/series        lista séries
GET /api/series/:id    uma série
```

**Duas requisições por tela, e cada uma com o tamanho da tela.** A listagem
traz só o que a grade desenha; o detalhe traz o resto e as cópias. Pensado
para TV: medido com 50 filmes por página,

| | Antes | Agora |
|---|---|---|
| Listagem, sem compressão | 30,8 KB | 11,1 KB |
| Listagem, gzip/brotli | 12 KB | **3,6 KB** |
| Abrir um filme | 2 requisições | **1**, ~900 B |
| Recarregar sem mudança | 30,8 KB | **304**, 0 bytes |

Toda resposta sai comprimida (br/gzip, acima de 1 KB) e com `ETag`; as rotas
públicas mandam `Cache-Control: no-cache`, então o cliente guarda a resposta
mas pergunta sempre — e, sem sync no meio, a resposta é um 304 vazio.

O `:id` é o id da **obra**, não do torrent. O tipo vem da rota: `/api/series/:id`
com id de filme dá 404, e nenhum payload traz `type`.

Os quatro releases de *Divertida Mente* são **um** item em `/api/movies` e quatro
no `torrents` de `/api/movies/:id`. Para série, a obra é a série inteira e as cópias são os
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

`votes` continua no detalhe mesmo com a nota nula: é ele que explica o porquê.
Hoje isso silencia **82 das 805 obras** visíveis (10%) — a cauda obscura, quase
toda de lançamento recente.

A listagem e o detalhe não carregam a mesma coisa. **Na listagem, só o cartão**
— a sinopse sozinha era metade do peso da página:

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

`backdrop` fica na listagem porque a grade de TV costuma trocar o fundo conforme
o item em foco — custa ~65 bytes por filme, e a imagem só é baixada para quem
ganha foco.

**No detalhe, tudo de uma vez**, cópias incluídas — ao abrir um item a TV faz
uma requisição só:

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
      "infohash": "ac3ee9395349ad9a0b6ef13e1520511a6b9ee2b2",
      "source": "torrents-csv",
      "createdAt": "2026-09-14T07:10:30.000Z",
      "updatedAt": "2026-09-14T07:11:36.000Z"
    }
  ]
}
```

As cópias vêm da mais semeada para a menos. Hoje são de 1 a 3 por obra (média
1,02), então embutir custa pouco; na listagem elas não entram — engordariam a
página com o que a TV só usa ao abrir o item.

O payload é enxuto de propósito. `release_date`, `last_added`, `tmdb_id` e
`status` existem no banco e são usados para ordenar e filtrar, mas **não saem na
resposta**.

A obra que não casou com a TMDB some da listagem, mas continua acessível por
`/api/movies/:id`, com as cópias — some da vitrine, não do acervo.

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

| Campo | O quê | Listagem | Detalhe |
|---|---|---|---|
| `poster` | capa vertical | `w185` | `w342` |
| `backdrop` | horizontal, para fundo e banner | `w780` | `w1280` |

A grade da TV pede imagem pequena; a tela do item aberto, maior. Na TV, as
imagens pesam muito mais que o JSON: 50 capas somam na casa do megabyte, contra
~3,6 KB da página comprimida. Carregue as capas conforme entram na tela.

O banco guarda só o caminho (`/abc.jpg`); quem monta a URL é o DTO, com a tabela
`SIZES` em `api/public/dto.js`. Trocar um tamanho é uma linha, sem reprocessar
nada. `backdrop` é nulo com mais frequência que
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
requisição e serializam a resposta, em `src/api/public/schemas.js`. Um campo que
não esteja no schema não aparece na documentação **e não sai na resposta** — os
dois não têm como divergir.

| Arquivo | Responsabilidade |
|---|---|
| `api/public/schemas.js` | schemas JSON: filtros, obras, cópias e respostas |
| `api/public/docs.js` | metadados do OpenAPI e a página em `/api/docs` |
| `api/public/catalog.js` | rotas de `/api/movies` e `/api/series`, cada uma ligada ao seu schema |
| `api/public/dto.js` | linha do banco → payload (URLs de imagem, tamanho, nota) |

São quatro schemas, dois por entidade: `Movie`/`Series` para a obra e
`MovieTorrent`/`SeriesTorrent` para a cópia — cada par sai de uma função só, e
a de série apenas acrescenta `season` e `episode`. Todo campo é `required`: o
que não se sabe vai como `null`, nunca ausente, então o cliente não precisa
testar existência de chave.

Acrescentar um filtro é uma linha em `LIST_QUERY`, mais o `WHERE` em
`db/works.js`. A documentação acompanha sozinha.

## Painel (/admin)

Com o `serve` no ar, **<http://localhost:3000/admin>** atualiza o catálogo,
cancela o que estiver rodando, mostra o log ao vivo e edita a configuração.
Uma página só:

| Onde | O quê |
|---|---|
| Topo | status, *Atualizar catálogo*, *Buscar capas e notas*, *Cancelar*; ícone de configurações |
| Resumo | torrents indexados, obras casadas, distribuição do match e última execução |
| Trackers | um card por tracker: liga/desliga na hora, *Buscar torrents* só nele, *Editar* abre o painel lateral |
| Editar tracker | rps, páginas, parada antecipada, regras, termos e a zona de perigo (*Apagar resultados*) |
| Configurações (`#/configuracoes`) | página inteira, uma seção por assunto e cada chave junto do que ela liga: agendamento; TMDB + `TMDB_API_KEY`; debrid + token do provedor; acesso (`ADMIN_TOKEN`, `API_TOKEN`) |
| Log | ao vivo, colorido por tipo de linha |

Os nomes da tela são para quem usa; código, CLI, API e log continuam com
`sync` e `enrich`:

| Na tela | Job | O que faz |
|---|---|---|
| Atualizar catálogo | `sync` | busca torrents nos trackers ativos e, no fim, capas e notas |
| Buscar torrents (no card) | `sync` com `sources: [nome]` | o mesmo, só naquele tracker |
| Buscar capas e notas | `enrich` | só a TMDB, sem tocar nos trackers |

O estilo é Tailwind v4 pelo CDN (`@tailwindcss/browser`), sem etapa de build —
então o painel precisa de internet para carregar o CSS.

**Um job por vez.** Pedir outro com um rodando dá 409. Cancelar interrompe até a
requisição em andamento; as regras do tracker ficam para a próxima run.

O resultado de cada execução é `done`, `skipped`, `cancelled` ou `failed`, e
pode trazer um `reason` que o painel traduz em texto e atalho:

| Situação | Resultado | `reason` |
|---|---|---|
| *Buscar capas e notas* sem `TMDB_API_KEY` | `skipped` (pulada) | `no-tmdb-key` |
| *Atualizar catálogo* sem `TMDB_API_KEY` | `done`, com aviso: os torrents vieram | `no-tmdb-key` |
| *Atualizar catálogo* com a TMDB fora do ar | `done`, com aviso | `tmdb-failed` |

O botão *Buscar capas e notas* já avisa antes, com um ponto âmbar, quando falta
a chave.

**A configuração vem em camadas:** o que o source declara no código, depois o
`.env`, depois o que foi salvo no painel (tabela `setting`). Vale também para o
`npm run sync` da CLI. Trackers, atualização e TMDB valem a partir da próxima
run; `TMDB_MIN_VOTES` e os segredos valem já na próxima requisição.
*Restaurar padrões* apaga o que foi salvo, menos os segredos.

**O log não é gravado.** Vai para o terminal e para a tela; o servidor guarda só
as últimas 500 linhas em memória, para quem abrir o painel no meio de uma run.

### Agendamento

Em *Configurações → Agendamento* o catálogo se atualiza sozinho. A execução é a
mesma do botão *Atualizar catálogo*: busca os torrents e, no fim, capas e notas.

| Modo | Exemplo | Como conta |
|---|---|---|
| Em horário fixo | todo dia às 23:00; ou só seg e qua às 08:30 | pelo relógio do servidor |
| A cada intervalo | a cada 1 minuto, a cada 6 horas (até 7 dias) | a partir do **fim** da execução anterior |

- **Nada empilha.** O intervalo conta do fim da anterior, então uma execução
  longa não atropela a próxima. Se na hora marcada já houver uma rodando
  (manual, por exemplo), a agendada é pulada e o log registra.
- **Mudou a configuração, vale na hora:** o agendador se rearma ao salvar.
- **Só com o `serve` no ar.** A CLI (`npm run sync`) continua manual.
- O painel mostra a próxima em *Última execução*; a API, em
  `GET /api/admin/status` → `schedule.nextRunAt`.
- Vem desligado. É uma configuração do painel, sem variável no `.env`.

### Apagar resultados

Na zona de perigo do editor do tracker. A confirmação só libera o botão depois
de digitar o nome do tracker, e o servidor recusa enquanto um job roda — um sync
em andamento traria parte das linhas de volta na hora.

Apaga só os torrents daquele tracker. As obras e capas da TMDB ficam: são cache,
e se o torrent voltar no próximo sync a capa já está lá, sem nova consulta.

### Segredos

`TMDB_API_KEY`, `ADMIN_TOKEN`, `API_TOKEN` e `TORBOX_API_KEY` podem vir do `.env` ou ser
definidos pelo painel.
O do painel vale mais; *Remover do painel* devolve o do `.env`.

O que é salvo pelo painel vai para o banco **criptografado**, com a chave
`SECRETS_KEY` do `.env`:

```bash
npm run keygen     # imprime SECRETS_KEY=... para colar no .env
```

- **AES-256-GCM**, IV aleatório por valor, tag de 16 bytes. Adulterar o texto
  cifrado faz a leitura falhar em vez de devolver lixo.
- **Cada valor fica preso ao seu campo** (associated data): copiar o token cifrado
  para o lugar da chave da TMDB não abre.
- **O valor nunca volta para a tela.** A API só diz de onde ele vem (`panel`,
  `env` ou nenhum); o campo é só de escrita.
- **Sem `SECRETS_KEY`**, salvar segredo pelo painel é recusado. Chave inválida
  derruba o boot com a mensagem de como gerar uma.
- **Trocou a chave?** O que foi cifrado com a antiga é ignorado, não quebra
  nada: vale o `.env`, e o painel mostra o aviso para cadastrar de novo.

O que isso protege: uma cópia do `catalog.db` (backup, arquivo compartilhado)
não entrega a chave da TMDB nem o token. O que não protege: quem lê o `.env` lê
a `SECRETS_KEY` — mantenha o `.env` fora do repositório, como já está no
`.gitignore`.

**Acesso:** sem `ADMIN_TOKEN`, a API do painel só responde para localhost. Com
ele, o painel pede o token e o guarda no navegador; trocar o token pelo painel
vale na hora e o navegador que trocou já passa a usar o novo. O token trafega
em texto puro no HTTP: para expor o painel fora da máquina, ponha um proxy com
HTTPS na frente. As rotas do painel ficam fora do Swagger.

| Rota | |
|---|---|
| `GET /api/admin/status` | job atual, último resultado e números |
| `POST /api/admin/jobs/sync` | `{ sources?: [...] }` restringe os trackers |
| `POST /api/admin/jobs/enrich` | |
| `DELETE /api/admin/jobs/current` | cancela |
| `DELETE /api/admin/sources/:name/items` | apaga os torrents de um tracker |
| `GET /api/admin/events` | SSE: `status` e `log` |
| `GET` `PUT` `DELETE /api/admin/settings` | lê, altera parcialmente (inclusive `secrets`), restaura |

## Debrid (TorBox)

Entrega à TV o **link direto do vídeo** de um torrent, pelo provedor de debrid
configurado em *Configurações → Debrid*. Hoje o único provedor é o
[TorBox](https://torbox.app); a estrutura já comporta outros.

```
POST   /api/debrid/torrents          { "hash": "..." }  pede o vídeo (manda baixar se preciso)
GET    /api/debrid/torrents/:hash    só consulta: nunca adiciona nada
DELETE /api/debrid/torrents/:hash    cancela o download / remove da conta
```

O `hash` é o `infohash` de uma cópia, que vem no detalhe da obra (hex de 40 ou
base32 de 32 caracteres).

### O fluxo na TV

1. Ao escolher uma cópia, a TV faz o `POST`.
   - **Em cache no TorBox:** responde `200` e `ready` com a `url`, já na primeira chamada.
   - **Fora do cache:** o TorBox começa a baixar e a resposta é `202` `downloading`, com `progress` (0–100) e `eta`.
2. Enquanto não for `ready` ou `failed`, a TV consulta o `GET` a cada ~5 s.
   Ele é só leitura, então repetir não custa nada além da consulta.
3. Em `ready`, toca a `url`. Se a pessoa desistir, `DELETE`.

| `status` | Definitivo? | Traz |
|---|---|---|
| `ready` | sim | `url`, `file` (`name`, `size`) |
| `downloading` | não | `progress`, `eta`, `state` |
| `queued` | não | todas as vagas do TorBox ocupadas; tente o `POST` de novo mais tarde |
| `failed` | sim | `reason`: `no_video` ou `provider_failed` |

O `POST` é idempotente: um torrent que já está na conta só é descrito, não
adicionado de novo. O arquivo escolhido é o maior vídeo que não é `sample`.

### O link nunca é guardado

O link do TorBox expira. Ele não vai para o banco nem para cache nenhum: **cada
`ready` gera um link novo** na hora (`requestdl`), e as rotas respondem com
`Cache-Control: no-store`. A TV deve pedir o link logo antes de tocar, e não
guardá-lo.

### Segurança

- **`API_TOKEN`:** as rotas exigem `Authorization: Bearer <API_TOKEN>`. Elas
  gastam a conta paga e apagam torrents, então não ficam abertas como o catálogo.
  Sem `API_TOKEN` definido, só respondem para localhost. É um token separado do
  `ADMIN_TOKEN`: a TV não ganha acesso ao painel.
- **O token do TorBox fica no servidor.** Salvo pelo painel, vai cifrado para o
  banco, como os outros segredos. A TV nunca o recebe, e ele não aparece em
  erro nenhum.
- **Validação:** hash fora do formato dá `400` antes de qualquer chamada ao TorBox.

### Erros

Sempre `{ "error": "...", "code": "..." }`:

| HTTP | `code` | Quando |
|---|---|---|
| 503 | `not_configured` / `missing_token` | debrid desligado, ou sem o token do provedor |
| 404 | `not_found` | `GET`/`DELETE` de torrent que não está na conta |
| 502 | `provider_auth` | o TorBox recusou o token |
| 429 | `provider_rate_limit` | limite do TorBox (300/min; 60/h para adicionar fora do cache) |
| 502 / 504 | `provider_error` / `provider_unavailable` | o TorBox errou, caiu ou demorou |

### Endpoints do TorBox usados

Base `https://api.torbox.app/v1/api`, com `Authorization: Bearer`:

| Nosso uso | TorBox |
|---|---|
| já está na conta? | `GET /torrents/mylist?bypass_cache=true` |
| está em cache? | `GET /torrents/checkcached?hash=…&format=object` |
| mandar baixar | `POST /torrents/createtorrent` (form, `magnet`) |
| link do vídeo | `GET /torrents/requestdl?torrent_id&file_id&redirect=false` — o token vai na query, é como esse endpoint aceita |
| remover | `POST /torrents/controltorrent` `{ torrent_id, operation: "delete" }` |

### Adicionando um provedor

Crie `src/debrid/<nome>/` com o mesmo contrato do TorBox e acrescente uma linha
em `src/debrid/index.js`, mais o token em `config.debrid.tokens`:

```js
module.exports = {
  id: 'realdebrid',
  label: 'Real-Debrid',
  secret: 'realdebridToken',        // nome do segredo no painel
  create({ token, timeoutMs }) {
    return { resolve(hash), status(hash), remove(hash) };  // mesmos status do TorBox
  },
};
```

O select do painel, o campo do token (cifrado) e a validação da API se ajustam
sozinhos.

## Estrutura

```
src/
├─ index.js                  CLI
├─ config.js                 env com defaults
├─ settings/                 config efetiva: código + env + painel
│  ├─ index.js               store com cache, invalidado a cada gravação
│  ├─ merge.js               junta padrões, env e o que foi salvo
│  ├─ secrets.js             segredos cifrados: abrir, aplicar, gravar
│  └─ errors.js
├─ api/
│  ├─ server.js              monta o app: /api, /api/debrid, /api/admin e /admin
│  ├─ auth.js                token ou só localhost (painel e debrid)
│  ├─ public/                API de leitura
│  │  ├─ index.js            /health, /stats e os catálogos
│  │  ├─ catalog.js          rotas de filmes e séries
│  │  ├─ dto.js              linha do banco -> payload
│  │  ├─ schemas.js          schemas JSON (validação + serialização + Swagger)
│  │  └─ docs.js             Swagger UI em /api/docs
│  ├─ debrid/                rotas da TV: pedir, consultar e remover
│  │  ├─ index.js            auth, no-store e erros com code
│  │  └─ schemas.js          validação do hash + Swagger
│  └─ admin/                 API do painel
│     ├─ index.js            liga feed, runner, auth e rotas
│     ├─ schemas.js          validação das rotas do painel
│     └─ routes/             jobs, settings, sources, events (SSE), ui (arquivos)
├─ debrid/                  provedores de debrid
│  ├─ index.js               registry e criação a partir da config
│  ├─ errors.js              DebridError: HTTP + code estável
│  └─ torbox/
│     ├─ index.js            resolve, status, remove
│     ├─ api.js              chamadas HTTP ao TorBox
│     └─ files.js            qual arquivo é o vídeo; status do TorBox -> nosso
├─ job/
│  ├─ pipeline.js            sync + enrich, usado pela CLI e pelo painel
│  ├─ runner.js              um job por vez, com cancelamento
│  ├─ scheduler.js           dispara a atualização no horário salvo no painel
│  ├─ schedule.js            próxima execução e descrição (funções puras)
│  ├─ sync.js                paginação e critério de parada
│  └─ enrich.js              casa cada obra com a TMDB
├─ db/
│  ├─ index.js               conexão, schema, migrations e transação
│  ├─ repo.js                fachada sobre as tabelas
│  ├─ items.js               tabela item: gravação, regras e limpeza por tracker
│  ├─ works.js               tabela work: obra, enriquecimento e leituras da API
│  └─ settings.js            tabela setting: o que foi salvo no painel
├─ lib/
│  ├─ classifier/            ver acima
│  ├─ http.js                fetch com throttle, retry e cancelamento
│  ├─ feed.js                log e status ao vivo, só em memória
│  ├─ infohash.js            hex/base32 -> hex, magnet
│  └─ secrets.js             AES-256-GCM e geração de chave
├─ sources/
│  ├─ index.js               registry
│  ├─ torrentsCsv.js         API JSON
│  ├─ redesTorrents/
│  │  ├─ index.js            catálogo HTML
│  │  └─ parse.js            extração, sem rede (testável)
│  └─ tmdb.js                busca e regra de match
└─ ui/                       painel: HTML + ES modules + Tailwind (CDN), sem build
   ├─ index.html
   ├─ main.js                estado da página e ações
   ├─ lib/                   api, dom, ícones, nomes da tela
   ├─ components/            controles, painel lateral, confirmação, tags
   └─ views/                 topo, resumo, trackers, editor, configurações, log
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
- **`work` órfã não é limpa.** Quando as regras do tracker ou o *Apagar
  resultados* removem itens, a obra fica na tabela. Ela some das rotas e das
  contagens (`/api/stats` e o painel só contam obra com ao menos um torrent),
  mas continua no banco servindo de cache: se o release voltar, a capa já está
  lá, sem nova consulta à TMDB.
- **`/api/movies` depende do enrich ter rodado.** É o enrich que cria a linha em
  `work`, inclusive para o que não casou. Sem `TMDB_API_KEY` configurada na
  primeira sincronização, as rotas do catálogo vêm vazias.
- **As cópias vêm todas no detalhe, sem paginar.** Hoje o máximo observado é 3
  por obra; se um tracker de séries trouxer centenas de episódios, isso muda.
- **As regras de tracker apagam de verdade.** `requireYear` e `dedupe` fazem
  `DELETE`; o item volta no próximo sync se ainda existir no tracker, mas o
  `created_at` dele recomeça.
- **`updated_at` avança a cada sync**, mesmo quando nada mudou no item — ele
  marca "última vez que foi visto", não "última vez que mudou".
- **Cobertura limitada aos termos.** Um release dublado que não case com nenhum
  dos 11 termos é invisível para o job.
