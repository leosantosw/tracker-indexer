import { BookOpenIcon, RefreshCwIcon, SlidersHorizontalIcon, SparklesIcon, SquareIcon } from 'lucide-react'
import { Link, NavLink } from 'react-router'

import { Hint } from '@/components/app/hint'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useJobActions } from '@/features/jobs/use-job-actions'
import { JobPill } from '@/layout/job-pill'
import { ThemeToggle } from '@/layout/theme-toggle'
import { JOBS } from '@/lib/labels'
import { paths } from '@/lib/paths'
import type { JobStatus, Settings } from '@/lib/schemas'

function JobButtons({ job, settings }: { job: JobStatus; settings: Settings }) {
  const actions = useJobActions()
  const hasEnabled = settings.sources.some((source) => source.enabled)
  const hasTmdbKey = Boolean(settings.secrets.statuses.tmdbApiKey?.source)

  if (job.running) {
    return (
      <Button variant="destructive" disabled={job.running.cancelling} onClick={actions.cancel}>
        <SquareIcon data-icon="inline-start" />
        <span className="hidden sm:inline">{job.running.cancelling ? 'Cancelando…' : 'Cancelar'}</span>
      </Button>
    )
  }

  return (
    <>
      <Hint label={hasTmdbKey ? JOBS.enrich.hint : 'Falta a TMDB_API_KEY: cadastre em Configurações → TMDB'}>
        <Button variant="outline" className="relative" disabled={actions.starting} onClick={actions.enrich}>
          <SparklesIcon data-icon="inline-start" />
          <span className="hidden sm:inline">{JOBS.enrich.action}</span>
          {!hasTmdbKey && <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-amber-500 ring-2 ring-background" />}
        </Button>
      </Hint>
      <Hint label={hasEnabled ? JOBS.sync.hint : 'Nenhum tracker adicionado'}>
        <Button disabled={!hasEnabled || actions.starting} onClick={() => actions.sync()}>
          <RefreshCwIcon data-icon="inline-start" />
          <span className="hidden sm:inline">{JOBS.sync.action}</span>
        </Button>
      </Hint>
    </>
  )
}

export function AppHeader({ job, settings }: { job?: JobStatus; settings?: Settings }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3 sm:px-8 lg:px-10">
        <Link to={paths.dashboard} className="flex items-center gap-2.5" title="Painel">
          <img src="/admin/logo.png" alt="" width={40} height={40} className="size-10 shrink-0 dark:rounded-xl dark:bg-zinc-100 dark:p-1" />
          <h1 className="font-brand text-xl leading-none font-black tracking-tight">
            <span className="text-foreground">tracker-</span>
            <span className="text-brand">indexer</span>
          </h1>
        </Link>

        {job && <JobPill job={job} />}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Hint label="Documentação da API">
            <Button variant="ghost" size="icon-lg" asChild>
              <a href="/api/docs" target="_blank" rel="noopener" aria-label="Documentação da API">
                <BookOpenIcon className="size-5" />
              </a>
            </Button>
          </Hint>
          <Hint label="Configurações">
            <Button variant="ghost" size="icon-lg" asChild>
              <NavLink to={paths.settings()} aria-label="Configurações" className="aria-[current=page]:bg-muted">
                <SlidersHorizontalIcon className="size-5" />
              </NavLink>
            </Button>
          </Hint>
          <ThemeToggle />
          <Separator orientation="vertical" className="mx-1 h-6!" />
          {job && settings && <JobButtons job={job} settings={settings} />}
        </div>
      </div>
    </header>
  )
}
