import { TerminalIcon, Trash2Icon } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'

import { Button } from '@/components/ui/button'
import { clockTime } from '@/lib/format'
import { useLogStore } from '@/lib/log-store'

const TONES: [RegExp, string][] = [
  [/falhou|erro|recusad|HTTP \d{3}|template mudou/i, 'text-rose-400'],
  [/cancel|pulado/i, 'text-amber-300'],
  [/concluido/i, 'text-emerald-400'],
  [/iniciado/i, 'text-indigo-300'],
]

const toneOf = (message: string) => TONES.find(([pattern]) => pattern.test(message))?.[1] ?? 'text-zinc-300'

const STICK_DISTANCE = 40

export function LogPanel() {
  const lines = useLogStore((state) => state.lines)
  const clear = useLogStore((state) => state.clear)
  const box = useRef<HTMLDivElement>(null)
  const stuck = useRef(true)

  useLayoutEffect(() => {
    if (box.current && stuck.current) box.current.scrollTop = box.current.scrollHeight
  }, [lines])

  function onScroll() {
    const node = box.current
    if (node) stuck.current = node.scrollHeight - node.scrollTop - node.clientHeight < STICK_DISTANCE
  }

  return (
    <div className="bg-zinc-950">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-5 py-2 text-xs text-zinc-500">
        <TerminalIcon className="size-3.5" />
        Saída do servidor, como no terminal
        <Button variant="ghost" size="xs" className="ml-auto text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300" onClick={clear}>
          <Trash2Icon data-icon="inline-start" />
          Limpar
        </Button>
      </div>
      <div ref={box} onScroll={onScroll} aria-live="polite" className="h-80 overflow-y-auto px-5 py-4 font-mono text-[12.5px] leading-relaxed">
        {lines.length ? (
          lines.map(({ at, message }, index) => (
            <div key={index} className="flex gap-4 break-words whitespace-pre-wrap">
              <time className="shrink-0 text-zinc-600 select-none">{clockTime(at)}</time>
              <span className={toneOf(message)}>{message}</span>
            </div>
          ))
        ) : (
          <p className="text-zinc-600">Nenhuma linha ainda.</p>
        )}
      </div>
    </div>
  )
}
