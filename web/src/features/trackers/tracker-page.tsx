import { zodResolver } from '@hookform/resolvers/zod'
import { ExternalLinkIcon, FlaskConicalIcon, MinusCircleIcon, PlayIcon, Trash2Icon } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Controller, FormProvider, useForm, useWatch } from 'react-hook-form'
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
import { AccessBadge } from '@/features/trackers/access-badge'
import { pagesFieldText } from '@/features/trackers/scan-text'
import { TrackerAvatar } from '@/features/trackers/tracker-avatar'
import { AccountSection } from '@/features/trackers/account-section'
import {
  accountSecret,
  ACCOUNT_FIELDS,
  toFormValues,
  toSettingsPatch,
  trackerFormFor,
  type AccountField,
  type TrackerForm,
} from '@/features/trackers/tracker-form'
import { warnInvalid } from '@/lib/form-errors'
import { formatNumber } from '@/lib/format'
import { CONTENT, MODE_LABEL, SOURCE_SYNC } from '@/lib/labels'
import { paths } from '@/lib/paths'
import { useClearSource, useLoaded, useSaveSettings } from '@/lib/queries'
import { contentSchema, type Settings, type Source } from '@/lib/schemas'

const SUBTITLE = {
  terms: 'Varre por termos de busca · resultado ordenado por seeders',
  pages: 'Varre a listagem do catálogo · mais novo primeiro',
}

type Mode = 'edit' | 'add'

type TrackerViewProps = { source: Source; indexed: number; running: boolean }

function TrackerHeader({ source, indexed, running, mode }: TrackerViewProps & { mode: Mode }) {
  const actions = useJobActions()
  const adding = mode === 'add'

  return (
    <header className="mb-8">
      <BackLink />
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <TrackerAvatar name={source.name} className="size-12" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-2xl font-semibold tracking-tight">{adding ? `Adicionar ${source.name}` : source.name}</h2>
            <Badge variant="secondary">{MODE_LABEL[source.mode]}</Badge>
            <AccessBadge access={source.access} />
            <Hint label={`Abrir ${new URL(source.site).host}`}>
              <Button variant="ghost" size="icon-sm" asChild>
                <a href={source.site} target="_blank" rel="noopener noreferrer" aria-label={`Abrir o site do ${source.name}`}>
                  <ExternalLinkIcon />
                </a>
              </Button>
            </Hint>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {SUBTITLE[source.mode]} · {adding ? 'revise a configuração e adicione' : `${formatNumber(indexed)} torrents indexados`}
          </p>
        </div>
        <Hint label="Lê a primeira página e mostra o que entraria, sem gravar">
          <Button type="button" variant="outline" onClick={() => openCheckDialog(source.name)}>
            <FlaskConicalIcon data-icon="inline-start" />
            Testar
          </Button>
        </Hint>
        {!adding && (
          <Hint label={SOURCE_SYNC.hint(source.name)}>
            <Button type="button" variant="outline" disabled={running} onClick={() => actions.sync([source.name])}>
              <PlayIcon data-icon="inline-start" />
              {SOURCE_SYNC.action}
            </Button>
          </Hint>
        )}
      </div>
    </header>
  )
}

function DangerRow({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-4">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  )
}

function DangerZone({ source, indexed, running }: TrackerViewProps) {
  const navigate = useNavigate()
  const clear = useClearSource()
  const save = useSaveSettings()

  async function onRemove() {
    const ok = await confirmAction({
      title: `Remover ${source.name}?`,
      description: `Ele sai das atualizações do catálogo. Os ${formatNumber(indexed)} torrents já indexados continuam; para apagá-los, use Apagar resultados antes.`,
      confirmLabel: 'Remover',
    })
    if (!ok) return
    save.mutate(
      { sources: { [source.name]: { enabled: false } } },
      {
        onSuccess: () => {
          toast.success(`${source.name} removido`)
          navigate(paths.dashboard)
        },
      }
    )
  }

  async function onClear() {
    const ok = await confirmAction({ title: `Tem certeza que quer apagar os torrents de ${source.name}?`, confirmLabel: 'Apagar' })
    if (!ok) return
    clear.mutate(source.name, {
      onSuccess: ({ removed }) => toast.success(`${formatNumber(removed)} torrents de ${source.name} apagados`),
    })
  }

  return (
    <FormSection id="perigo" title="Zona de perigo" description="Ações que não dá para desfazer.">
      <div className="divide-y divide-destructive/20 rounded-xl border border-destructive/30">
        <DangerRow title="Apagar resultados" description={`Remove os ${formatNumber(indexed)} torrents deste tracker. Capas e notas da TMDB ficam.`}>
          <Hint label={running ? 'Espere o job atual terminar' : null}>
            <Button type="button" variant="destructive" disabled={!indexed || running || clear.isPending} onClick={onClear}>
              <Trash2Icon data-icon="inline-start" />
              Apagar
            </Button>
          </Hint>
        </DangerRow>
        <DangerRow title="Remover tracker" description="Tira o tracker das atualizações do catálogo. Dá para adicionar de novo depois.">
          <Button type="button" variant="destructive" disabled={save.isPending} onClick={onRemove}>
            <MinusCircleIcon data-icon="inline-start" />
            Remover
          </Button>
        </DangerRow>
      </div>
    </FormSection>
  )
}

const savedAccount = (source: Source, secrets: Settings['secrets']) =>
  Object.fromEntries(
    ACCOUNT_FIELDS.map((field) => [field, !secrets.encryption || Boolean(secrets.statuses[accountSecret(source.name, field)]?.source)])
  ) as Record<AccountField, boolean>

function TrackerFormView({ source, secrets, indexed, running, mode }: TrackerViewProps & { secrets: Settings['secrets']; mode: Mode }) {
  const navigate = useNavigate()
  const save = useSaveSettings()
  const form = useForm<TrackerForm>({
    resolver: zodResolver(trackerFormFor(source, savedAccount(source, secrets))),
    defaultValues: toFormValues(source),
  })
  const byTerms = source.mode === 'terms'
  const adding = mode === 'add'
  const [content, pages] = useWatch({ control: form.control, name: ['content', 'pages'] })
  const pagesText = pagesFieldText(source, content, pages)

  function onSubmit(values: TrackerForm) {
    save.mutate(
      toSettingsPatch(source.name, values, adding),
      {
        onSuccess: () => {
          toast.success(adding ? `${source.name} adicionado` : `${source.name} salvo`)
          navigate(paths.dashboard)
        },
      }
    )
  }

  return (
    <FormProvider {...form}>
      <form className="pb-28" onSubmit={form.handleSubmit(onSubmit, warnInvalid)}>
        <TrackerHeader source={source} indexed={indexed} running={running} mode={mode} />
        <div className="space-y-6">
          {source.requiresLogin && <AccountSection source={source} secrets={secrets} />}
          <FormSection id="geral" title="Geral" description="O que o tracker traz para o catálogo e em que ritmo.">
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
                label={pagesText.label}
                description={pagesText.description}
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
            {source.freeleechOnly !== undefined && (
              <Controller
                control={form.control}
                name="freeleechOnly"
                render={({ field }) => (
                  <SwitchField
                    label="Apenas freeleech"
                    description="Só lê torrents freeleech: baixar não conta no ratio da sua conta."
                    checked={Boolean(field.value)}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            )}
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

          {!adding && <DangerZone source={source} indexed={indexed} running={running} />}
        </div>
        <PageBar saving={save.isPending} submitLabel={adding ? 'Adicionar tracker' : undefined} />
      </form>
    </FormProvider>
  )
}

function redirectFor(source: Source | undefined, mode: Mode) {
  if (!source) return paths.dashboard
  if (mode === 'edit' && !source.enabled) return paths.addTracker(source.name)
  if (mode === 'add' && source.enabled) return paths.tracker(source.name)
  return null
}

function TrackerRoute({ name, mode }: { name: string; mode: Mode }) {
  const navigate = useNavigate()
  const { status, settings } = useLoaded()
  const source = settings.sources.find((item) => item.name === name)
  const indexed = status.stats.sources.find((row) => row.source === name)?.total ?? 0
  const [redirect] = useState(() => redirectFor(source, mode))

  useEffect(() => {
    if (!redirect) return
    if (!source) toast.error(`tracker desconhecido: ${name}`)
    navigate(redirect, { replace: true })
  }, [redirect, source, name, navigate])

  if (!source || redirect) return null
  return (
    <TrackerFormView
      key={JSON.stringify([source, settings.secrets])}
      source={source}
      secrets={settings.secrets}
      indexed={indexed}
      running={Boolean(status.job.running)}
      mode={mode}
    />
  )
}

function TrackerRouteByParam({ mode }: { mode: Mode }) {
  const { name = '' } = useParams()
  return <TrackerRoute key={`${mode}:${name}`} name={name} mode={mode} />
}

export const TrackerPage = () => <TrackerRouteByParam mode="edit" />

export const AddTrackerPage = () => <TrackerRouteByParam mode="add" />
