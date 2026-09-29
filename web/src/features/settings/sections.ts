import type { SecretMeta } from '@/components/app/secret-field'

export const SECTIONS = {
  schedule: {
    id: 'agendamento',
    title: 'Agendamento',
    description: 'Quando o catálogo se atualiza sozinho: primeiro os torrents, depois capas e notas.',
  },
  tmdb: {
    id: 'tmdb',
    title: 'TMDB',
    description: 'Capas, sinopses e notas. A chave e os votos mínimos valem na hora; idioma e ritmo, na próxima execução.',
  },
  debrid: {
    id: 'debrid',
    title: 'Debrid',
    description: 'Provedor que entrega à TV o link do vídeo.',
  },
  access: {
    id: 'acesso',
    title: 'Acesso',
    description: 'Quem entra no painel e quem usa a API da TV. Sem token, a rota não responde para ninguém.',
  },
}

export const SECRET_META: Record<string, SecretMeta> = {
  tmdbApiKey: {
    label: 'TMDB_API_KEY',
    hint: 'Gratuita em themoviedb.org → Settings → API.',
    missing: { label: 'ausente — sem capas e notas', variant: 'warning' },
  },
  adminToken: {
    label: 'ADMIN_TOKEN',
    hint: 'Protege o painel. Ao salvar, este navegador já passa a usar o novo token.',
    missing: { label: 'ausente — criado no primeiro acesso', variant: 'warning' },
    generate: true,
  },
  apiToken: {
    label: 'API_TOKEN',
    hint: 'Protege toda a /api, menos /api/health. Vazio: a API não responde e a TV não funciona.',
    missing: { label: 'ausente — API fechada', variant: 'destructive' },
    generate: true,
  },
}

export const providerTokenMeta = (provider: { id: string; label: string }): SecretMeta => ({
  label: `${provider.id.toUpperCase()}_API_KEY`,
  hint: `Token da API do ${provider.label}. Fica no servidor, cifrado; a TV nunca o vê.`,
  missing: { label: 'ausente', variant: 'warning' },
})
