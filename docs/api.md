# API

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

GET /api/categories    as linhas da tela inicial (com os primeiros filmes, se quiser)
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

A listagem tem paginação e a categoria escolhida:

| Parâmetro | Padrão | |
|---|---|---|
| `page` | `1` | página, a partir de 1 |
| `limit` | `50` | itens por página, máximo 200 |
| `category` | — | id de `/api/categories`; sem ele, a ordem padrão |

### Categorias

São **filtros salvos, não uma tabela**: saem do próprio catálogo, então aparecem
e somem sozinhas conforme o acervo muda. Não há nada a cadastrar no painel.

| Categoria | O quê |
|---|---|
| `novidades` | Adicionados recentemente (pela entrada no catálogo) |
| `melhores` | Melhores notas |
| `genero-<gênero>` | um por gênero com pelo menos 10 filmes (`genero-terror`, `genero-acao`…) |

```json
// GET /api/categories?preview=12
{
  "categories": [
    { "id": "novidades", "title": "Adicionados recentemente", "total": 955, "movies": [ ... ] },
    { "id": "genero-terror", "title": "Terror", "total": 121, "movies": [ ... ] }
  ]
}
```

Com `preview`, cada categoria já vem com os primeiros filmes: a tela inicial da
TV inteira em **uma requisição**. Para continuar uma linha, `/api/movies?category=<id>`
pagina como sempre. Categoria vazia não entra na lista, e um `category`
desconhecido dá 404.

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
