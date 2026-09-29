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
        <CardTitle className="flex min-w-0 items-center gap-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
          <span className="truncate">{label}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function BigNumber({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-2xl font-semibold tracking-tight tabular-nums', className)}>{children}</p>
}

export function Caption({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('mt-1 truncate text-sm text-muted-foreground', className)}>{children}</p>
}
