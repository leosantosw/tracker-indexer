export const paths = {
  dashboard: '/',
  settings: (section?: string) => (section ? `/configuracoes?secao=${section}` : '/configuracoes'),
  tracker: (name: string) => `/trackers/${encodeURIComponent(name)}`,
}
