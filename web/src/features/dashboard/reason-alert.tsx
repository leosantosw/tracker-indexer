import { TriangleAlertIcon } from 'lucide-react'
import { Link } from 'react-router'

import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { REASONS } from '@/lib/labels'
import { paths } from '@/lib/paths'
import type { JobStatus } from '@/lib/schemas'

export function ReasonAlert({ job }: { job: JobStatus }) {
  const reason = job.last?.reason ? REASONS[job.last.reason] : null
  if (!reason) return null

  return (
    <Alert variant="warning">
      <TriangleAlertIcon />
      <AlertDescription>{reason.text}</AlertDescription>
      {reason.fix && (
        <AlertAction>
          <Button variant="link" size="sm" className="text-inherit" asChild>
            <Link to={paths.settings(reason.fix.section)}>{reason.fix.label}</Link>
          </Button>
        </AlertAction>
      )}
    </Alert>
  )
}
