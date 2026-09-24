# Painel

Com o `serve` no ar, **<http://localhost:3000/admin>** atualiza o catálogo,
cancela o que estiver rodando, mostra o log ao vivo e edita a configuração.
Uma página só:

| Onde | O quê |
|---|---|
| Topo | status, *Atualizar catálogo*, *Buscar capas e notas*, *Cancelar*; ícone de configurações |
| Resumo | torrents indexados, obras casadas, distribuição do match e última execução |
| Trackers | uma linha por tracker: liga/desliga na hora, *Testar*, *Buscar torrents* só nele; clicar abre a página dele |
| Página do tracker (`#/trackers/<nome>`) | rps, páginas, parada antecipada, regras, termos e a zona de perigo (*Apagar resultados*) |
| Configurações (`#/configuracoes`) | página inteira, uma seção por assunto e cada chave junto do que ela liga: agendamento; TMDB + `TMDB_API_KEY`; debrid + token do provedor; acesso (`ADMIN_TOKEN`, `API_TOKEN`) |
| Atividade | etapas da execução com progresso real (trackers, depois capas e notas), avisos e o resumo da última; os logs técnicos ficam recolhidos em *Ver logs técnicos* |

Os nomes da tela são para quem usa; código, CLI, API e log continuam com
`sync` e `enrich`:

| Na tela | Job | O que faz |
|---|---|---|
| Atualizar catálogo | `sync` | busca torrents nos trackers ativos e, no fim, capas e notas |
| Buscar torrents (na lista) | `sync` com `sources: [nome]` | o mesmo, só naquele tracker |
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

Na zona de perigo da página do tracker. Pede uma confirmação simples, e o
servidor recusa enquanto um job roda — um sync
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

**Acesso:** sem `ADMIN_TOKEN`, a API do painel só responde para localhost — e
requisição que chega por proxy (com `X-Forwarded-For`, `X-Real-IP` ou
`Forwarded`) não conta como local, mesmo vindo de `127.0.0.1`. Com
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
| `POST /api/admin/sources/:name/check` | testa o tracker: lê a 1ª página e diz o que entraria, sem gravar |
| `GET /api/admin/events` | SSE: `status` (com o `progress` da execução), `schedule` e `log` |
| `GET` `PUT` `DELETE /api/admin/settings` | lê, altera parcialmente (inclusive `secrets`), restaura |
