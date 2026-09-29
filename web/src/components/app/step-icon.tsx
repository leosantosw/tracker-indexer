import { CheckIcon, MinusIcon, XIcon } from 'lucide-react'

import { Spinner } from '@/components/ui/spinner'
import type { StepState } from '@/lib/schemas'
import { cn } from '@/lib/utils'

const filled = 'grid size-4 shrink-0 place-items-center rounded-full text-white'

export function StepIcon({ state }: { state: StepState }) {
  if (state === 'running') return <Spinner className="size-4 text-primary" />
  if (state === 'done') return <span className={cn(filled, 'bg-emerald-500')}><CheckIcon className="size-3" /></span>
  if (state === 'skipped') return <span className={cn(filled, 'bg-amber-400')}><MinusIcon className="size-3" /></span>
  if (state === 'failed') return <span className={cn(filled, 'bg-rose-500')}><XIcon className="size-3" /></span>
  return <span className="size-4 shrink-0 rounded-full border-2 border-zinc-300 dark:border-zinc-700" />
}
