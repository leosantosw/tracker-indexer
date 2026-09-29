import { TerminalIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardFooter } from '@/components/ui/card'
import { IdleDetails, IdleSummary } from '@/features/activity/idle-view'
import { LogPanel } from '@/features/activity/log-panel'
import { RunningView } from '@/features/activity/running-view'
import { plural } from '@/lib/format'
import { useLogStore } from '@/lib/log-store'
import type { JobStatus } from '@/lib/schemas'
import { readStored, writeStored } from '@/lib/storage'

const LOG_OPEN_KEY = 'activity:log-open'

function LogToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const lineCount = useLogStore((state) => state.lines.length)

  return (
    <Button variant="ghost" size="sm" className="shrink-0" onClick={onToggle}>
      <TerminalIcon data-icon="inline-start" />
      {open ? 'Ocultar' : 'Ver'} logs
      {lineCount > 0 && <span className="text-muted-foreground tabular-nums">({plural(lineCount, 'linha', 'linhas')})</span>}
    </Button>
  )
}

export function ActivityCard({ job }: { job: JobStatus }) {
  const [logOpen, setLogOpen] = useState(() => readStored(LOG_OPEN_KEY) === '1')

  function toggleLog() {
    setLogOpen(!logOpen)
    writeStored(LOG_OPEN_KEY, logOpen ? '0' : '1')
  }

  if (!job.running) {
    return (
      <Card className="gap-0 rounded-2xl py-0">
        <div className="flex items-center gap-3 py-2 pr-2 pl-5">
          <IdleSummary last={job.last} />
          <div className="ml-auto">
            <LogToggle open={logOpen} onToggle={toggleLog} />
          </div>
        </div>
        <IdleDetails last={job.last} />
        {logOpen && <LogPanel />}
      </Card>
    )
  }

  return (
    <Card className="gap-0 rounded-2xl py-0">
      <div className="p-5 sm:p-6">
        <RunningView running={job.running} />
      </div>
      <CardFooter className="justify-end border-t px-3 py-2">
        <LogToggle open={logOpen} onToggle={toggleLog} />
      </CardFooter>
      {logOpen && <LogPanel />}
    </Card>
  )
}
