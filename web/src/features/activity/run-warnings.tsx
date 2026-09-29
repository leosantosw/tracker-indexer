import { TriangleAlertIcon } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import type { Progress } from '@/lib/schemas'

export function RunWarnings({ warnings }: { warnings?: Progress['warnings'] }) {
  if (!warnings?.length) return null

  return (
    <Alert variant="warning">
      <TriangleAlertIcon />
      <AlertDescription>
        <ul className="space-y-1">
          {warnings.map(({ source, text }, index) => (
            <li key={index}>
              {source && <b className="font-semibold">{source}: </b>}
              {text}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
