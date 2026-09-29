import { ChevronRightIcon } from 'lucide-react'
import { useNavigate } from 'react-router'

import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Empty, EmptyDescription, EmptyHeader } from '@/components/ui/empty'
import { AccessBadge } from '@/features/trackers/access-badge'
import { TrackerAvatar } from '@/features/trackers/tracker-avatar'
import { CONTENT, MODE_LABEL } from '@/lib/labels'
import { paths } from '@/lib/paths'
import type { Source } from '@/lib/schemas'

type AddTrackerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  available: Source[]
}

export function AddTrackerDialog({ open, onOpenChange, available }: AddTrackerDialogProps) {
  const navigate = useNavigate()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar tracker</DialogTitle>
          <DialogDescription>Escolha o tracker; em seguida você revisa a configuração antes de adicionar.</DialogDescription>
        </DialogHeader>
        {available.length ? (
          <ul className="-mx-2 max-h-96 overflow-y-auto">
            {available.map((source) => (
              <li key={source.name}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-muted"
                  onClick={() => navigate(paths.addTracker(source.name))}
                >
                  <TrackerAvatar name={source.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{source.name}</span>
                      <Badge variant="secondary">{MODE_LABEL[source.mode]}</Badge>
                      <AccessBadge access={source.access} />
                    </div>
                    <p className="text-sm text-muted-foreground">{CONTENT[source.content].short}</p>
                  </div>
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <Empty className="py-6">
            <EmptyHeader>
              <EmptyDescription>Todos os trackers disponíveis já foram adicionados.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </DialogContent>
    </Dialog>
  )
}
