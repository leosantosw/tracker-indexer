import { XIcon } from 'lucide-react'
import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'

import { Badge } from '@/components/ui/badge'
import { splitTags } from '@/lib/tags'
import { cn } from '@/lib/utils'

type TagInputProps = {
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  minLength?: number
  invalid?: boolean
}

export function TagInput({ value, onChange, placeholder, minLength = 1, invalid = false }: TagInputProps) {
  const [draft, setDraft] = useState('')
  const input = useRef<HTMLInputElement>(null)

  function commit(text: string) {
    const fresh = splitTags(text, value, minLength)
    if (fresh.length) onChange([...value, ...fresh])
    setDraft('')
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      commit(draft)
    } else if (event.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault()
    commit(event.clipboardData.getData('text'))
  }

  return (
    <div
      aria-invalid={invalid}
      onClick={() => input.current?.focus()}
      className={cn(
        'flex min-h-24 cursor-text flex-wrap content-start items-center gap-1.5 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors',
        'focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30'
      )}
    >
      {value.map((tag) => (
        <Badge key={tag} variant="outline" className="h-6 gap-1 pr-1">
          {tag}
          <button
            type="button"
            aria-label={`remover ${tag}`}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => onChange(value.filter((item) => item !== tag))}
          >
            <XIcon className="size-3" />
          </button>
        </Badge>
      ))}
      <input
        ref={input}
        value={draft}
        placeholder={placeholder}
        className="min-w-36 flex-1 bg-transparent py-1 outline-none placeholder:text-muted-foreground"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={() => commit(draft)}
      />
    </div>
  )
}
