import { useQuery } from '@tanstack/react-query'
import { CheckIcon, FlaskConicalIcon, TriangleAlertIcon } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { useCheckStore } from '@/features/trackers/check-store'
import { api } from '@/lib/api'
import { formatNumber, plural } from '@/lib/format'
import { CHECK_STATUS } from '@/lib/labels'
import type { CheckResult, CheckStatus } from '@/lib/schemas'

function StatusBadge({ status }: { status: CheckStatus }) {
  const { label, variant } = CHECK_STATUS[status]
  return <Badge variant={variant}>{label}</Badge>
}

function Verdict({ result }: { result: CheckResult }) {
  const ok = result.totals.ok ?? 0
  const good = ok > 0
  const text = good
    ? `Funcionando: ${formatNumber(ok)} de ${plural(result.entries.length, 'título', 'títulos')} da primeira página entrariam no catálogo.`
    : result.entries.length
      ? 'Nenhum título entraria no catálogo. O site pode ter mudado o layout.'
      : 'A primeira página veio vazia. O site pode estar fora do ar ou ter mudado o layout.'

  return (
    <Alert variant={good ? 'success' : 'destructive'}>
      {good ? <CheckIcon /> : <TriangleAlertIcon />}
      <AlertDescription>{text}</AlertDescription>
    </Alert>
  )
}

function Results({ result }: { result: CheckResult }) {
  const totals = Object.entries(result.totals) as [CheckStatus, number][]

  return (
    <div className="space-y-4">
      <Verdict result={result} />
      {totals.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {totals.map(([status, total]) => (
            <span key={status} className="inline-flex items-center gap-1.5">
              <StatusBadge status={status} />
              <span className="text-sm text-muted-foreground tabular-nums">{formatNumber(total)}</span>
            </span>
          ))}
        </div>
      )}
      {result.entries.length > 0 && (
        <ul className="max-h-80 divide-y overflow-y-auto rounded-xl border">
          {result.entries.map(({ status, detail }, index) => (
            <li key={index} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="w-28 shrink-0">
                <StatusBadge status={status} />
              </span>
              <span className="truncate" title={detail ?? ''}>
                {detail ?? '—'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CheckContent({ name }: { name: string }) {
  const check = useQuery({
    queryKey: ['check', name],
    queryFn: () => api.checkSource(name),
    gcTime: 0,
    retry: false,
    meta: { silent: true },
  })

  if (check.isPending) {
    return (
      <div className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
        <Spinner className="size-5 text-primary" />
        Lendo a primeira página de {name}… tracker HTML pode levar uns 20 segundos.
      </div>
    )
  }
  if (check.isError) {
    return (
      <Alert variant="destructive">
        <TriangleAlertIcon />
        <AlertDescription>{check.error.message}</AlertDescription>
      </Alert>
    )
  }
  return <Results result={check.data} />
}

export function CheckDialog() {
  const name = useCheckStore((state) => state.name)

  return (
    <Dialog open={Boolean(name)} onOpenChange={(open) => !open && useCheckStore.setState({ name: null })}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="flex-row items-start gap-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
            <FlaskConicalIcon className="size-5" />
          </div>
          <div className="grid gap-1">
            <DialogTitle>Teste de {name}</DialogTitle>
            <DialogDescription>Lê a primeira página e mostra o que entraria no catálogo. Nada é gravado.</DialogDescription>
          </div>
        </DialogHeader>
        {name && <CheckContent name={name} />}
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  )
}
