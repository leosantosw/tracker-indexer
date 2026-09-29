import type { ReactNode } from 'react'

import { Card } from '@/components/ui/card'
import { sectionAnchor } from '@/lib/section-anchor'
import { cn } from '@/lib/utils'

type FormSectionProps = {
  id: string
  title: string
  description: string
  stacked?: boolean
  children: ReactNode
}

export function FormSection({ id, title, description, stacked = false, children }: FormSectionProps) {
  return (
    <Card id={sectionAnchor(id)} className="scroll-mt-24 rounded-2xl py-0">
      <div className={cn('grid gap-6 p-6 md:p-8', !stacked && 'md:grid-cols-3 md:gap-10')}>
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <div className={cn('space-y-6', !stacked && 'md:col-span-2')}>{children}</div>
      </div>
    </Card>
  )
}
