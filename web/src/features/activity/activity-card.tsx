import { TerminalIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardFooter } from '@/components/ui/card'
import { IdleView } from '@/features/activity/idle-view'
import { LogPanel } from '@/features/activity/log-panel'
import { RunningView } from '@/features/activity/running-view'
import { plural } from '@/lib/format'
import { useLogStore } from '@/lib/log-store'
import type { JobStatus } from '@/lib/schemas'
import { readStored, writeStored } from '@/lib/storage'

const LOG_OPEN_KEY = 'activity:log-open'

export function ActivityCard({ job }: { job: JobStatus }) {
  const [logOpen, setLogOpen] = useState(() => readStored(LOG_OPEN_KEY) === '1')
  const lineCount = useLogStore((state) => state.lines.length)

  function toggleLog() {
    setLogOpen(!logOpen)
    writeStored(LOG_OPEN_KEY, logOpen ? '0' : '1')
  }

  return (
    <Card className="gap-0 rounded-2xl py-0">
      <div className="p-5 sm:p-6">{job.running ? <RunningView running={job.running} /> : <IdleView last={job.last} />}</div>
      <CardFooter className="justify-end border-t px-3 py-2">
        <Button variant="ghost" size="sm" onClick={toggleLog}>
          <TerminalIcon data-icon="inline-start" />
          {logOpen ? 'Ocultar' : 'Ver'} logs técnicos
          {lineCount > 0 && <span className="text-muted-foreground tabular-nums">({plural(lineCount, 'linha', 'linhas')})</span>}
        </Button>
      </CardFooter>
      {logOpen && <LogPanel />}
    </Card>
  )
}
