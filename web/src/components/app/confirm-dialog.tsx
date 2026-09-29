import { TriangleAlertIcon } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useConfirmStore } from '@/components/app/confirm-store'

export function ConfirmDialog() {
  const request = useConfirmStore((state) => state.request)
  const settle = useConfirmStore((state) => state.settle)

  return (
    <AlertDialog open={Boolean(request)} onOpenChange={(open) => !open && settle(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <TriangleAlertIcon />
          </AlertDialogMedia>
          <AlertDialogTitle>{request?.title}</AlertDialogTitle>
          {request?.description && <AlertDialogDescription>{request.description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => settle(true)}>
            {request?.confirmLabel ?? 'Confirmar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
