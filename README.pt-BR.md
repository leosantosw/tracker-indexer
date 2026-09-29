<div align="center">

<img src="web/public/logo.png" alt="tracker-indexer" width="96" height="96">

# tracker-indexer

**Indexa trackers de torrent, casa cada título com a TMDB e entrega um catálogo
de filmes e séries pronto para um app de TV.**

[English](README.md) · **Português**

[![Licença: GPL-3.0](https://img.shields.io/badge/licen%C3%A7a-GPL--3.0-blue)](LICENSE)
![Node](https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white)
![Fastify](https://img.shields.io/badge/fastify-5-000000?logo=fastify&logoColor=white)
![React](https://img.shields.io/badge/painel-react-61DAFB?logo=react&logoColor=black)

</div>

## Recursos

- **Indexação incremental** de trackers por API JSON ou por HTML, com throttle,
  retry e cancelamento.
- **Classificador de releases:** separa filmes e séries e extrai título, ano,
  temporada, resolução, áudio e HDR.
- **Enriquecimento pela TMDB:** capa, sinopse, gêneros, nota e trailer, com
  match conservador e match manual pelo painel.
- **API REST para TV:** listas enxutas, detalhe completo, busca, categorias,
  compressão e ETag. Documentação em Swagger.
- **Debrid (TorBox):** entrega um link direto do vídeo sem expor o token da conta.
- **Painel web:** adiciona e configura trackers, agenda atualizações, acompanha
  cada execução com log ao vivo e guarda segredos cifrados.
- **Sem banco externo:** usa o SQLite embutido do Node.

## Começando

Requer **Node.js 22+**.

```bash
git clone https://github.com/leosantosw/tracker-indexer.git
cd tracker-indexer
npm install
npm run build             # compila o painel

cp .env.example .env
npm run keygen            # cole a SECRETS_KEY gerada no .env

npm run serve             # API em :3000/api, painel em :3000/admin
```

No primeiro acesso a **<http://localhost:3000/admin>** você cria o token do
painel. De lá dá para adicionar trackers, cadastrar a `TMDB_API_KEY` (gratuita
em [themoviedb.org](https://www.themoviedb.org/settings/api)) e rodar a
primeira atualização. A API fica documentada em
**<http://localhost:3000/api/docs>**.

Todas as variáveis de ambiente são opcionais; veja o
[guia de configuração](docs/configuration.md).

### Comandos

| Comando | O que faz |
|---|---|
| `npm run serve` | sobe a API, a documentação e o painel |
| `npm run sync` | atualiza o catálogo pela linha de comando |
| `npm run enrich` | busca só capas e notas na TMDB |
| `npm run check-source <tracker>` | testa a primeira página de um tracker, sem gravar |
| `npm test` / `npm run test:web` | testes do backend e do painel |

## Documentação

Os guias estão em inglês.

| Guia | Conteúdo |
|---|---|
| [Configuration](docs/configuration.md) | variáveis de ambiente e acesso |
| [API](docs/api.md) | rotas, payloads, categorias, busca, debrid e erros |
| [Panel](docs/panel.md) | trackers, agendamento, segredos, log e a API do admin |
| [Architecture](docs/architecture.md) | sync, enriquecimento, classificador, estrutura e como adicionar um tracker |

## Contribuindo

Issues e pull requests são bem-vindos. Antes de abrir um PR, rode `npm test` e
`npm run test:web`. Para um tracker novo, inclua a saída do
`npm run check-source`. As convenções do código estão em [AGENTS.md](AGENTS.md).

## Aviso

Este projeto indexa **metadados públicos** de torrents. Ele não hospeda nem
distribui nenhum arquivo. Respeite os direitos autorais e os termos de uso dos
sites indexados; o uso é de responsabilidade de quem roda o servidor.

Este produto usa a API da TMDB, mas não é endossado nem certificado pela TMDB.

## Licença

[GPL-3.0](LICENSE) © leosantosw
