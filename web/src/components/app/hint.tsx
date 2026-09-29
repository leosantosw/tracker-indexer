import type { ReactNode } from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function Hint({ label, children }: { label?: ReactNode; children: ReactNode }) {
  if (!label) return children
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex min-w-0">{children}</span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
