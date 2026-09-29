import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { paths } from '@/lib/paths'

type PageBarProps = {
  extra?: ReactNode
  saving?: boolean
  submitLabel?: string
}

export function PageBar({ extra, saving = false, submitLabel = 'Salvar alterações' }: PageBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-5 py-3 sm:px-8 lg:px-10">
        {extra}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" asChild>
            <Link to={paths.dashboard}>Voltar</Link>
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Spinner data-icon="inline-start" />}
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
