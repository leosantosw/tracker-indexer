import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type StatCardProps = {
  icon: LucideIcon
  label: string
  children: ReactNode
}

export function StatCard({ icon: Icon, label, children }: StatCardProps) {
  return (
    <Card className="gap-3 rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 text-sm font-medium text-muted-foreground">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function BigNumber({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-3xl font-semibold tracking-tight tabular-nums', className)}>{children}</p>
}

export function Caption({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-sm text-muted-foreground">{children}</p>
}
