import { zodResolver } from '@hookform/resolvers/zod'
import { Undo2Icon } from 'lucide-react'
import { parseAsString, useQueryState } from 'nuqs'
import { useEffect, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { BackLink } from '@/components/app/back-link'
import { confirmAction } from '@/components/app/confirm-store'
import { PageBar } from '@/components/app/page-bar'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useAccessStore } from '@/features/access/access-store'
import { AccessSection } from '@/features/settings/access-section'
import { DebridSection } from '@/features/settings/debrid-section'
import { ScheduleSection } from '@/features/settings/schedule-section'
import { SECTIONS } from '@/features/settings/sections'
import { settingsFormSchema, toFormValues, toPatch, type SettingsForm } from '@/features/settings/settings-form'
import { TmdbSection } from '@/features/settings/tmdb-section'
import { when } from '@/lib/format'
import { paths } from '@/lib/paths'
import { sectionAnchor } from '@/lib/section-anchor'
import { useLoaded, useResetSettings, useSaveSettings } from '@/lib/queries'
import type { Settings } from '@/lib/schemas'
import { adminToken } from '@/lib/token'

const scrollToSection = (id: string, behavior: ScrollBehavior = 'smooth') =>
  document.getElementById(sectionAnchor(id))?.scrollIntoView({ behavior, block: 'start' })

function SectionNav() {
  const [, setSection] = useQueryState('secao', parseAsString)

  return (
    <nav className="sticky top-24 hidden self-start lg:block" aria-label="Seções das configurações">
      <ul className="space-y-1">
        {Object.values(SECTIONS).map(({ id, title }) => (
          <li key={id}>
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start text-muted-foreground hover:text-foreground"
              onClick={() => setSection(id).then(() => scrollToSection(id))}
            >
              {title}
            </Button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function EncryptionNotice() {
  return (
    <Alert variant="warning" className="mt-4">
      <AlertTitle>Criptografia desligada: chaves e tokens só pelo .env</AlertTitle>
      <AlertDescription>
        <p>
          Para salvá-los por aqui, gere uma chave com <code>npm run keygen</code>, coloque em SECRETS_KEY no .env e reinicie.
        </p>
      </AlertDescription>
    </Alert>
  )
}

function SettingsFormView({ settings, nextRun }: { settings: Settings; nextRun: string | null }) {
  const navigate = useNavigate()
  const save = useSaveSettings()
  const reset = useResetSettings()
  const grant = useAccessStore((state) => state.grant)
  const form = useForm<SettingsForm>({ resolver: zodResolver(settingsFormSchema), defaultValues: toFormValues(settings) })

  function onSubmit(values: SettingsForm) {
    save.mutate(toPatch(values), {
      onSuccess: () => {
        if (values.secrets.adminToken) {
          adminToken.set(values.secrets.adminToken)
          grant()
        }
        toast.success('Configurações salvas')
        navigate(paths.dashboard)
      },
    })
  }

  async function removeSecret(name: string) {
    const ok = await confirmAction({
      title: 'Remover segredo do painel?',
      description: 'O valor salvo aqui é apagado. Se houver um no .env, ele volta a valer.',
      confirmLabel: 'Remover',
    })
    if (ok) save.mutate({ secrets: { [name]: null } }, { onSuccess: () => toast.success('Segredo removido') })
  }

  async function restoreDefaults() {
    const ok = await confirmAction({
      title: 'Restaurar padrões?',
      description: 'Descarta o que foi salvo pelo painel em trackers, agendamento, TMDB e debrid. Os segredos são mantidos.',
      confirmLabel: 'Restaurar',
    })
    if (ok) reset.mutate(undefined, { onSuccess: () => toast.success('Padrões restaurados') })
  }

  return (
    <FormProvider {...form}>
      <form className="pb-28" onSubmit={form.handleSubmit(onSubmit)}>
        <header className="mb-8">
          <BackLink />
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Configurações</h2>
          {!settings.secrets.encryption && <EncryptionNotice />}
        </header>
        <div className="grid gap-10 lg:grid-cols-[12rem_1fr]">
          <SectionNav />
          <div className="space-y-6">
            <ScheduleSection nextRun={nextRun} />
            <TmdbSection secrets={settings.secrets} onRemoveSecret={removeSecret} />
            <DebridSection settings={settings} onRemoveSecret={removeSecret} />
            <AccessSection secrets={settings.secrets} onRemoveSecret={removeSecret} />
          </div>
        </div>
        <PageBar
          saving={save.isPending}
          extra={
            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" title="Os segredos são mantidos" onClick={restoreDefaults}>
              <Undo2Icon data-icon="inline-start" />
              <span className="hidden sm:inline">Restaurar padrões</span>
            </Button>
          }
        />
      </form>
    </FormProvider>
  )
}

export function SettingsPage() {
  const { status, settings } = useLoaded()
  const [section] = useQueryState('secao', parseAsString)
  const [initialSection] = useState(section)
  const nextRun = status.schedule.nextRunAt ? when(status.schedule.nextRunAt) : null

  useEffect(() => {
    if (initialSection) scrollToSection(initialSection, 'instant')
  }, [initialSection])

  return <SettingsFormView key={JSON.stringify(settings)} settings={settings} nextRun={nextRun} />
}
