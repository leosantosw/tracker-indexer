import { Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { confirmAction } from '@/components/app/confirm-store'
import { Hint } from '@/components/app/hint'
import { Button } from '@/components/ui/button'
import { clearDescription } from '@/features/unmatched/clear-text'
import { useUnmatchedFilters } from '@/features/unmatched/use-unmatched-filters'
import { formatNumber, plural } from '@/lib/format'
import { useClearUnmatched, useStatus } from '@/lib/queries'

export function ClearUnmatchedButton({ total }: { total: number }) {
  const [filters] = useUnmatchedFilters()
  const running = Boolean(useStatus().data?.job.running)
  const clear = useClearUnmatched()

  async function onClear() {
    const ok = await confirmAction({
      title: 'Apagar resultados sem match?',
      description: clearDescription({ total, status: filters.status, tracker: filters.tracker }),
      confirmLabel: 'Apagar',
    })
    if (!ok) return
    clear.mutate(
      { status: filters.status, source: filters.tracker },
      {
        onSuccess: ({ removed, works }) =>
          toast.success(`${formatNumber(removed)} torrents apagados de ${plural(works, 'obra', 'obras')}`),
      }
    )
  }

  return (
    <Hint label={running ? 'Espere o job atual terminar' : 'Apaga os torrents das obras listadas com os filtros atuais'}>
      <Button variant="ghost" className="text-destructive hover:text-destructive" disabled={!total || running || clear.isPending} onClick={onClear}>
        <Trash2Icon data-icon="inline-start" />
        Apagar resultados
      </Button>
    </Hint>
  )
}
