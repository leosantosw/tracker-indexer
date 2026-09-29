import { GlobeIcon, LockIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { Source } from '@/lib/schemas'

const ACCESS = {
  public: { label: 'público', icon: GlobeIcon, hint: 'Aberto: não pede conta nem convite' },
  private: { label: 'privado', icon: LockIcon, hint: 'Fechado: pede conta ou convite' },
}

export function AccessBadge({ access, className }: { access: Source['access']; className?: string }) {
  const { label, icon: Icon, hint } = ACCESS[access]
  return (
    <Badge variant="outline" className={className} title={hint}>
      <Icon data-icon="inline-start" />
      {label}
    </Badge>
  )
}
