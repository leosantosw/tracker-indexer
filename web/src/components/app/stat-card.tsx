import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type StatCardProps = {
  icon: LucideIcon
  label: string
  children: ReactNode
}

export function StatCard({ icon: Icon, label, children }: StatCardProps) {
  return (
    <Card className="gap-3 rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Icon className="size-4" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function BigNumber({ children }: { children: ReactNode }) {
  return <p className="text-3xl font-semibold tracking-tight tabular-nums">{children}</p>
}

export function Caption({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-sm text-muted-foreground">{children}</p>
}
