import { Link } from 'react-router'

import { paths } from '@/lib/paths'

export function BackLink() {
  return (
    <Link to={paths.dashboard} className="text-sm text-muted-foreground hover:text-foreground">
      ← Painel
    </Link>
  )
}
