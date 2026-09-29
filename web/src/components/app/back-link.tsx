import { ArrowLeftIcon } from 'lucide-react'
import { Link } from 'react-router'

import { paths } from '@/lib/paths'

export function BackLink() {
  return (
    <Link to={paths.dashboard} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeftIcon className="size-4" />
      Painel
    </Link>
  )
}
