import { PencilIcon, Trash2Icon, XIcon } from 'lucide-react'
import { useRef, useState } from 'react'

import { CopyButton } from '@/components/app/copy-button'
import { Badge, type BadgeVariant } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { randomToken } from '@/lib/random'
import type { SecretStatus } from '@/lib/schemas'

const SOURCE_BADGE: Record<'panel' | 'env', { label: string; variant: BadgeVariant }> = {
  panel: { label: 'salva no painel', variant: 'success' },
  env: { label: 'vinda do .env', variant: 'info' },
}

const MASK = '****************'

export type SecretMeta = {
  label: string
  hint: string
  missing: { label: string; variant: BadgeVariant }
  generate?: boolean
}

type SecretFieldProps = {
  meta: SecretMeta
  status: SecretStatus
  encryption: boolean
  value: string
  onChange: (value: string) => void
  onRemove: () => void
}

export function SecretField({ meta, status, encryption, value, onChange, onRemove }: SecretFieldProps) {
  const isSet = Boolean(status.source)
  const [editing, setEditing] = useState(!isSet)
  const [revealed, setRevealed] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const badge = status.source ? SOURCE_BADGE[status.source] : meta.missing
  const writable = encryption && editing

  function toggleEditing() {
    onChange('')
    setRevealed(false)
    setEditing(!editing)
    if (!editing) requestAnimationFrame(() => input.current?.focus())
  }

  function generate() {
    setRevealed(true)
    onChange(randomToken())
    requestAnimationFrame(() => input.current?.select())
  }

  const editButton = isSet && (
    <Button type="button" variant="outline" disabled={!encryption} onClick={toggleEditing}>
      {editing ? <XIcon data-icon="inline-start" /> : <PencilIcon data-icon="inline-start" />}
      {editing ? 'Cancelar' : 'Editar'}
    </Button>
  )

  const field = (
    <Input
      ref={input}
      type={revealed ? 'text' : 'password'}
      className="font-mono"
      autoComplete="off"
      spellCheck={false}
      disabled={!writable}
      placeholder={editing ? 'novo valor' : MASK}
      value={value}
      onChange={(event) => onChange(event.target.value.trim())}
    />
  )

  return (
    <div className="space-y-2 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <code className="text-sm font-semibold">{meta.label}</code>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">{meta.hint}</p>
      {meta.generate ? (
        <div className="space-y-2">
          {field}
          <div className="flex gap-2">
            {writable && (
              <>
                <Button type="button" variant="outline" onClick={generate}>
                  Gerar
                </Button>
                <CopyButton value={() => value} onFallback={() => (setRevealed(true), input.current?.select())} />
              </>
            )}
            {editButton}
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          {field}
          {editButton}
        </div>
      )}
      {status.error && <p className="text-xs text-destructive">{status.error}</p>}
      {status.source === 'panel' && (
        <Button type="button" variant="ghost" size="sm" className="-ml-2 text-destructive hover:text-destructive" onClick={onRemove}>
          <Trash2Icon data-icon="inline-start" />
          Remover do painel
        </Button>
      )}
    </div>
  )
}
