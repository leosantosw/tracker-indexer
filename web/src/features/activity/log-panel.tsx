import { TerminalIcon, Trash2Icon } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { isLogView, LOG_VIEWS, visibleLines, type LogView } from '@/features/activity/log-filter'
import { clockTime } from '@/lib/format'
import { useLogStore } from '@/lib/log-store'
import type { LogLevel } from '@/lib/schemas'
import { readStored, writeStored } from '@/lib/storage'
import { cn } from '@/lib/utils'

const VIEW_KEY = 'activity:log-view'
const STICK_DISTANCE = 40

const LEVEL_STYLE: Record<LogLevel, { label: string; tag: string; text: string }> = {
  debug: { label: 'DEBUG', tag: 'text-zinc-500', text: 'text-zinc-500' },
  info: { label: 'INFO', tag: 'text-sky-400', text: 'text-zinc-200' },
  warn: { label: 'AVISO', tag: 'text-amber-400', text: 'text-amber-200' },
  error: { label: 'ERRO', tag: 'text-rose-400', text: 'text-rose-200' },
}

function storedView(): LogView {
  const stored = readStored(VIEW_KEY)
  return isLogView(stored) ? stored : 'normal'
}

export function LogPanel() {
  const lines = useLogStore((state) => state.lines)
  const clear = useLogStore((state) => state.clear)
  const [view, setView] = useState<LogView>(storedView)
  const box = useRef<HTMLDivElement>(null)
  const stuck = useRef(true)
  const shown = visibleLines(lines, view)

  useLayoutEffect(() => {
    if (box.current && stuck.current) box.current.scrollTop = box.current.scrollHeight
  }, [shown.length, view])

  function onScroll() {
    const node = box.current
    if (node) stuck.current = node.scrollHeight - node.scrollTop - node.clientHeight < STICK_DISTANCE
  }

  function changeView(next: string) {
    if (!isLogView(next)) return
    setView(next)
    writeStored(VIEW_KEY, next)
    stuck.current = true
  }

  return (
    <div className="bg-zinc-950">
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 px-5 py-2 text-xs text-zinc-500">
        <TerminalIcon className="size-3.5" />
        <span>Saída do servidor</span>
        <ToggleGroup type="single" size="sm" value={view} onValueChange={changeView} className="ml-auto" aria-label="Filtro do log">
          {(Object.keys(LOG_VIEWS) as LogView[]).map((key) => (
            <ToggleGroupItem
              key={key}
              value={key}
              className="h-7 px-2.5 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 data-[state=on]:bg-zinc-800 data-[state=on]:text-zinc-100"
            >
              {LOG_VIEWS[key].label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Button variant="ghost" size="xs" className="text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300" onClick={clear}>
          <Trash2Icon data-icon="inline-start" />
          Limpar
        </Button>
      </div>
      <div ref={box} onScroll={onScroll} aria-live="polite" className="h-80 overflow-y-auto px-5 py-4 font-mono text-[12.5px] leading-relaxed">
        {shown.length ? (
          <div role="log" className="grid grid-cols-[auto_3.5rem_minmax(0,9rem)_1fr] gap-x-4 gap-y-0.5">
            {shown.map(({ at, level, scope, message }, index) => {
              const style = LEVEL_STYLE[level]
              return (
                <div key={index} className="contents" data-level={level}>
                  <time className="text-zinc-600 select-none">{clockTime(at)}</time>
                  <span className={cn('font-semibold', style.tag)}>{style.label}</span>
                  <span className="truncate text-zinc-500" title={scope}>
                    {scope}
                  </span>
                  <span className={cn('break-words whitespace-pre-wrap', style.text)}>{message}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-zinc-600">{lines.length ? 'Nenhuma linha com esse filtro.' : 'Nenhuma linha ainda.'}</p>
        )}
      </div>
    </div>
  )
}
