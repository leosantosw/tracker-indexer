import { useCancelJob, useStartJob } from '@/lib/queries'

export function useJobActions() {
  const start = useStartJob()
  const cancel = useCancelJob()

  return {
    sync: (sources?: string[]) => start.mutate({ job: 'sync', sources }),
    enrich: () => start.mutate({ job: 'enrich' }),
    cache: () => start.mutate({ job: 'cache' }),
    cancel: () => cancel.mutate(),
    starting: start.isPending,
  }
}
