import { DatabaseZapIcon } from 'lucide-react'

import { Hint } from '@/components/app/hint'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useJobActions } from '@/features/jobs/use-job-actions'
import { cachePercent, cacheRowText } from '@/features/settings/cache-stats'
import { JOBS } from '@/lib/labels'
import { useLoaded } from '@/lib/queries'

export function CacheOverview({ unsaved }: { unsaved: boolean }) {
  const { status } = useLoaded()
  const actions = useJobActions()
  const running = Boolean(status.job.running)
  const blocked = running ? 'Espere o job atual terminar' : unsaved ? 'Salve o provedor antes de verificar' : null

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Cache por tracker</p>
          <p className="mt-0.5 text-xs text-muted-foreground">O que toca na hora, sem esperar o download.</p>
        </div>
        <Hint label={blocked ?? JOBS.cache.hint}>
          <Button type="button" variant="outline" disabled={Boolean(blocked) || actions.starting} onClick={actions.cache}>
            <DatabaseZapIcon data-icon="inline-start" />
            {JOBS.cache.action}
          </Button>
        </Hint>
      </div>
      {status.stats.cache.length > 0 ? (
        <ul className="space-y-3">
          {status.stats.cache.map((row) => (
            <li key={row.source} className="space-y-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <span className="font-medium">{row.source}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{cacheRowText(row)}</span>
              </div>
              <Progress value={cachePercent(row)} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum torrent indexado ainda.</p>
      )}
    </div>
  )
}
