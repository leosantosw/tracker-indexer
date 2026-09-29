import { CopyIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

type CopyButtonProps = {
  value: () => string
  onFallback?: () => void
}

export function CopyButton({ value, onFallback }: CopyButtonProps) {
  async function copy() {
    const text = value().trim()
    if (!text) return toast.warning('gere ou digite um token primeiro')

    try {
      await navigator.clipboard.writeText(text)
      toast.success('token copiado')
    } catch {
      onFallback?.()
      toast.warning('não deu para copiar sozinho: o token está selecionado, use Ctrl+C')
    }
  }

  return (
    <Button type="button" variant="outline" onClick={copy}>
      <CopyIcon data-icon="inline-start" />
      Copiar
    </Button>
  )
}
