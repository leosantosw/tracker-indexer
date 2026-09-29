import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FilmIcon, SearchIcon } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { closeMatchDialog, useMatchStore } from '@/features/unmatched/match-store'
import { sortByYear } from '@/features/unmatched/sort-by-year'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/queries'
import type { TmdbCandidate, UnmatchedWork } from '@/lib/schemas'

const TYPE_LABEL = { movie: 'filme', series: 'série' } as const

const searchSchema = z.object({
  query: z.string().trim().min(1).max(200),
  year: z.string().regex(/^\d{0,4}$/),
})

type SearchForm = z.infer<typeof searchSchema>

function Poster({ url }: { url?: string | null }) {
  if (url) return <img src={url} alt="" loading="lazy" className="h-18 w-12 shrink-0 rounded-md bg-muted object-cover" />
  return (
    <div className="grid h-18 w-12 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
      <FilmIcon className="size-4" />
    </div>
  )
}

function Note({ children }: { children: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
}

function MatchForm({ work }: { work: UnmatchedWork }) {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState(work.title)
  const form = useForm<SearchForm>({
    resolver: zodResolver(searchSchema),
    defaultValues: { query: work.title, year: work.year ? String(work.year) : '' },
  })
  const year = Number(useWatch({ control: form.control, name: 'year' })) || null

  const search = useQuery({
    queryKey: ['tmdb-search', work.type, query],
    queryFn: () => api.tmdbSearch(work.type, query),
    meta: { silent: true },
    retry: false,
  })

  const match = useMutation({
    mutationFn: (candidate: TmdbCandidate) => api.manualMatch(work.id, candidate.tmdbId),
    onSuccess: (_result, candidate) => {
      toast.success(`"${work.title}" casada com ${candidate.title}`)
      queryClient.invalidateQueries({ queryKey: queryKeys.unmatched })
      queryClient.invalidateQueries({ queryKey: queryKeys.status })
      closeMatchDialog()
    },
  })

  return (
    <>
      <form className="flex gap-2" onSubmit={form.handleSubmit((values) => setQuery(values.query))}>
        <Input aria-label="Texto enviado à TMDB" maxLength={200} {...form.register('query')} />
        <Input
          type="number"
          className="w-24 shrink-0 tabular-nums"
          placeholder="Ano"
          min={1870}
          max={2100}
          aria-label="Ano, para ordenar os resultados"
          title="Não filtra a busca: só sobe para o topo quem bate com o ano (±1)"
          {...form.register('year')}
        />
        <Button type="submit" className="shrink-0">
          <SearchIcon data-icon="inline-start" />
          Buscar
        </Button>
      </form>
      <div className="min-h-0 overflow-y-auto overscroll-contain rounded-xl border sm:max-h-[28rem]">
        {search.isPending ? (
          <div className="flex items-center justify-center gap-3 py-6 text-sm text-muted-foreground">
            <Spinner className="size-5 text-primary" />
            Buscando na TMDB…
          </div>
        ) : search.isError ? (
          <Note>{search.error.message}</Note>
        ) : !search.data.length ? (
          <Note>Nada encontrado. Tente o título original, em inglês, ou sem subtítulo.</Note>
        ) : (
          <ul className="divide-y">
            {sortByYear(search.data, year).map(({ candidate, fits }) => (
              <li key={candidate.tmdbId} className="flex gap-3 px-3 py-2.5">
                <Poster url={candidate.poster} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium">{candidate.title}</span>
                    {candidate.year && <span className="text-sm text-muted-foreground tabular-nums">({candidate.year})</span>}
                    {fits && <Badge variant="success">ano bate</Badge>}
                  </div>
                  {candidate.originalTitle && candidate.originalTitle !== candidate.title && (
                    <p className="truncate text-xs text-muted-foreground">{candidate.originalTitle}</p>
                  )}
                  {candidate.overview && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{candidate.overview}</p>}
                </div>
                <Button variant="outline" className="shrink-0 self-center" disabled={match.isPending} onClick={() => match.mutate(candidate)}>
                  Usar este
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

export function MatchDialog() {
  const work = useMatchStore((state) => state.work)

  return (
    <Dialog open={Boolean(work)} onOpenChange={(open) => !open && closeMatchDialog()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_auto_minmax(0,1fr)_auto] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Match manual</DialogTitle>
          {work && (
            <DialogDescription>
              "{work.title}"{work.year ? ` (${work.year})` : ''}, {TYPE_LABEL[work.type]}. Escolha a obra certa; as próximas
              atualizações seguem essa escolha.
            </DialogDescription>
          )}
        </DialogHeader>
        {work && <MatchForm key={work.id} work={work} />}
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  )
}
