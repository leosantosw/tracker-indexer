const relative = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

const pad = (value: number) => String(value).padStart(2, '0')

export const formatNumber = (value: number) => value.toLocaleString('pt-BR')

export const plural = (count: number, one: string, many: string) => `${formatNumber(count)} ${count === 1 ? one : many}`

export const clockTime = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR')

export function ago(iso: string, now = Date.now()) {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000)
  if (seconds > -10) return 'agora'
  if (Math.abs(seconds) < 60) return relative.format(seconds, 'second')
  if (Math.abs(seconds) < 3600) return relative.format(Math.round(seconds / 60), 'minute')
  if (Math.abs(seconds) < 86400) return relative.format(Math.round(seconds / 3600), 'hour')
  return relative.format(Math.round(seconds / 86400), 'day')
}

export function when(iso: string, now = new Date()) {
  const date = new Date(iso)
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const startOf = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
  const days = Math.round((startOf(date) - startOf(now)) / 86400000)

  if (days === 0) return `hoje às ${time}`
  if (days === 1) return `amanhã às ${time}`
  const day = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  return `${WEEKDAYS[date.getDay()]}, ${day} às ${time}`
}

export function elapsed(iso: string, now = Date.now()) {
  const total = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000))
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}

export function duration(startedAt: string, finishedAt: string) {
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime()
  if (ms < 1000) return '<1s'
  const seconds = Math.round(ms / 1000)
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m${pad(seconds % 60)}s`
}

export function countdown(ms: number) {
  if (ms <= 0) return 'agora'
  const total = Math.floor(ms / 1000)
  const days = Math.floor(total / 86400)
  const clock = `${pad(Math.floor((total % 86400) / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
  return days ? `${days}d ${clock}` : clock
}

export const percent = (value: number, total: number) => (total ? Math.round((value / total) * 100) : 0)

export const formatShare = (value: number) => `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
