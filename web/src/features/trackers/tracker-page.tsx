import { zodResolver } from '@hookform/resolvers/zod'
import { FlaskConicalIcon, PlayIcon, Trash2Icon } from 'lucide-react'
import { useEffect } from 'react'
import { Controller, FormProvider, useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { BackLink } from '@/components/app/back-link'
import { confirmAction } from '@/components/app/confirm-store'
import { FormField } from '@/components/app/form-field'
import { FormSection } from '@/components/app/form-section'
import { Hint } from '@/components/app/hint'
import { NumberInput } from '@/components/app/number-input'
import { PageBar } from '@/components/app/page-bar'
import { SwitchField } from '@/components/app/switch-field'
import { TagInput } from '@/components/app/tag-input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useJobActions } from '@/features/jobs/use-job-actions'
import { openCheckDialog } from '@/features/trackers/check-store'
import { TrackerAvatar } from '@/features/trackers/tracker-avatar'
import { toFormValues, toPatch, trackerFormFor, type TrackerForm } from '@/features/trackers/tracker-form'
import { warnInvalid } from '@/lib/form-errors'
import { formatNumber } from '@/lib/format'
import { CONTENT, MODE_LABEL, SOURCE_SYNC } from '@/lib/labels'
import { paths } from '@/lib/paths'
import { useClearSource, useLoaded, useSaveSettings } from '@/lib/queries'
import { contentSchema, type Source } from '@/lib/schemas'

const SUBTITLE = {
  terms: 'Varre por termos de busca · resultado ordenado por seeders',
  pages: 'Varre a listagem do catálogo · mais novo primeiro',
}

type TrackerViewProps = { source: Source; indexed: number; running: boolean }

function TrackerHeader({ source, indexed, running }: TrackerViewProps) {
  const actions = useJobActions()

  return (
    <header className="mb-8">
      <BackLink />
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <TrackerAvatar source={source} className="size-12" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-2xl font-semibold tracking-tight">{source.name}</h2>
            <Badge variant="secondary">{MODE_LABEL[source.mode]}</Badge>
            {source.enabled ? <Badge variant="success">ativo</Badge> : <Badge variant="secondary">inativo</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {SUBTITLE[source.mode]} · {formatNumber(indexed)} torrents indexados
          </p>
        </div>
        <Hint label="Lê a primeira página e mostra o que entraria, sem gravar">
          <Button type="button" variant="outline" onClick={() => openCheckDialog(source.name)}>
            <FlaskConicalIcon data-icon="inline-start" />
            Testar
          </Button>
        </Hint>
        <Hint label={source.enabled ? SOURCE_SYNC.hint(source.name) : 'Ative o tracker para buscar torrents'}>
          <Button type="button" variant="outline" disabled={!source.enabled || running} onClick={() => actions.sync([source.name])}>
            <PlayIcon data-icon="inline-start" />
            {SOURCE_SYNC.action}
          </Button>
        </Hint>
      </div>
    </header>
  )
}

function DangerZone({ source, indexed, running }: TrackerViewProps) {
  const clear = useClearSource()

  async function onClear() {
    const ok = await confirmAction({ title: `Tem certeza que quer apagar os torrents de ${source.name}?`, confirmLabel: 'Apagar' })
    if (!ok) return
    clear.mutate(source.name, {
      onSuccess: ({ removed }) => toast.success(`${formatNumber(removed)} torrents de ${source.name} apagados`),
    })
  }

  return (
    <FormSection id="perigo" title="Zona de perigo" description="Ações que não dá para desfazer.">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-destructive/30 p-4">
        <div>
          <p className="text-sm font-medium">Apagar resultados</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Remove os {formatNumber(indexed)} torrents deste tracker. Capas e notas da TMDB ficam.
          </p>
        </div>
        <Hint label={running ? 'Espere o job atual terminar' : null}>
          <Button type="button" variant="destructive" disabled={!indexed || running || clear.isPending} onClick={onClear}>
            <Trash2Icon data-icon="inline-start" />
            Apagar
          </Button>
        </Hint>
      </div>
    </FormSection>
  )
}

function TrackerFormView({ source, indexed, running }: TrackerViewProps) {
  const navigate = useNavigate()
  const save = useSaveSettings()
  const form = useForm<TrackerForm>({ resolver: zodResolver(trackerFormFor(source)), defaultValues: toFormValues(source) })
  const byTerms = source.mode === 'terms'

  function onSubmit(values: TrackerForm) {
    save.mutate(
      { sources: { [source.name]: toPatch(values) } },
      {
        onSuccess: () => {
          toast.success(`${source.name} salvo`)
          navigate(paths.dashboard)
        },
      }
    )
  }

  return (
    <FormProvider {...form}>
      <form className="pb-28" onSubmit={form.handleSubmit(onSubmit, warnInvalid)}>
        <TrackerHeader source={source} indexed={indexed} running={running} />
        <div className="space-y-6">
          <FormSection id="geral" title="Geral" description="Se o tracker entra na atualização do catálogo e em que ritmo.">
            <Controller
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <SwitchField
                  label="Tracker ativo"
                  description="Inativo, ele fica fora de toda atualização do catálogo — pela CLI também."
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <FormField<TrackerForm, 'content'> name="content" label="Conteúdo" description="O que este tracker traz para o catálogo.">
              {({ value, onChange, id }) => (
                <Select value={value} onValueChange={onChange}>
                  <SelectTrigger id={id} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {contentSchema.options.map((content) => (
                      <SelectItem key={content} value={content}>
                        {CONTENT[content].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <FormField<TrackerForm, 'rps'>
              name="rps"
              label="Requisições por segundo"
              description="Cortesia com o site: abaixo de 1 espaça ainda mais as chamadas."
            >
              {(field) => <NumberInput {...field} min={0.1} step={0.1} />}
            </FormField>
          </FormSection>

          <FormSection id="varredura" title="Varredura" description="Até onde cada execução vai.">
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField<TrackerForm, 'pages'>
                name="pages"
                label={byTerms ? 'Páginas por termo' : 'Páginas por varredura'}
                description="Vazio: vai até a última página."
              >
                {(field) => <NumberInput {...field} min={1} placeholder="todas" />}
              </FormField>
              <FormField<TrackerForm, 'stopAfterQuietPages'>
                name="stopAfterQuietPages"
                label="Parar após N sem novidade"
                description={byTerms ? 'Aqui parar cedo perde torrent novo.' : 'Vazio varre até o fim.'}
              >
                {(field) => <NumberInput {...field} min={1} placeholder="nunca" />}
              </FormField>
            </div>
          </FormSection>

          <FormSection id="regras" title="Regras" description="Valem só para o catálogo deste tracker.">
            <Controller
              control={form.control}
              name="requireYear"
              render={({ field }) => (
                <SwitchField
                  label="Exigir ano (apenas para filmes)"
                  description="Item sem ano fica de fora: sem ele não dá para casar com a TMDB."
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Controller
              control={form.control}
              name="dedupeBySeeders"
              render={({ field }) => (
                <SwitchField
                  label="Deduplicar por seeders"
                  description="Da mesma obra fica só a cópia mais semeada. Não serve para tracker sem seeders."
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </FormSection>

          {byTerms && (
            <FormSection
              id="termos"
              title="Termos de busca"
              description="Mínimo de 3 caracteres. A busca é AND: termo composto só traz subconjunto do simples."
            >
              <FormField<TrackerForm, 'terms'> name="terms" label="Termos">
                {({ value, onChange, ...field }) => (
                  <TagInput value={value ?? []} onChange={onChange} minLength={3} placeholder="novo termo + Enter" invalid={field['aria-invalid']} />
                )}
              </FormField>
            </FormSection>
          )}

          <DangerZone source={source} indexed={indexed} running={running} />
        </div>
        <PageBar saving={save.isPending} />
      </form>
    </FormProvider>
  )
}

export function TrackerPage() {
  const { name = '' } = useParams()
  const navigate = useNavigate()
  const { status, settings } = useLoaded()
  const source = settings.sources.find((item) => item.name === name)
  const indexed = status.stats.sources.find((row) => row.source === name)?.total ?? 0

  useEffect(() => {
    if (source) return
    toast.error(`tracker desconhecido: ${name}`)
    navigate(paths.dashboard, { replace: true })
  }, [source, name, navigate])

  if (!source) return null
  return <TrackerFormView key={JSON.stringify(source)} source={source} indexed={indexed} running={Boolean(status.job.running)} />
}
