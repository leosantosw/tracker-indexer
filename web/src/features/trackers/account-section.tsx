import { Controller, useFormContext } from 'react-hook-form'
import { toast } from 'sonner'

import { confirmAction } from '@/components/app/confirm-store'
import { FormSection } from '@/components/app/form-section'
import { SecretField, type SecretMeta } from '@/components/app/secret-field'
import { accountSecret, ACCOUNT_FIELDS, type AccountField, type TrackerForm } from '@/features/trackers/tracker-form'
import { useSaveSettings } from '@/lib/queries'
import type { Settings, Source } from '@/lib/schemas'

const ACCOUNT_META: Record<AccountField, SecretMeta> = {
  username: {
    label: 'Usuário',
    hint: 'O mesmo do login no site.',
    missing: { label: 'ausente — sem sincronizar', variant: 'warning' },
  },
  password: {
    label: 'Senha',
    hint: 'Fica no servidor, cifrada. O login é feito a cada execução e a sessão não é guardada.',
    missing: { label: 'ausente — sem sincronizar', variant: 'warning' },
    keepSpaces: true,
  },
}

const DESCRIPTION = {
  on: 'Tracker privado: sem a sua conta ele não lê nada.',
  off: 'Tracker privado: defina SECRETS_KEY no .env para guardar usuário e senha.',
}

type AccountSectionProps = { source: Source; secrets: Settings['secrets'] }

export function AccountSection({ source, secrets }: AccountSectionProps) {
  const { control } = useFormContext<TrackerForm>()
  const save = useSaveSettings()

  async function onRemove(name: string) {
    const ok = await confirmAction({
      title: 'Remover do painel?',
      description: `Sem usuário e senha, o ${source.name} para de sincronizar até você cadastrar de novo.`,
      confirmLabel: 'Remover',
    })
    if (ok) save.mutate({ secrets: { [name]: null } }, { onSuccess: () => toast.success('Removido do painel') })
  }

  return (
    <FormSection id="conta" title="Conta" description={secrets.encryption ? DESCRIPTION.on : DESCRIPTION.off}>
      {ACCOUNT_FIELDS.map((field) => {
        const name = accountSecret(source.name, field)
        const status = secrets.statuses[name] ?? { source: null }
        return (
          <Controller
            key={`${field}:${status.source ?? 'none'}`}
            control={control}
            name={field}
            render={({ field: input, fieldState }) => (
              <div className="space-y-1.5">
                <SecretField
                  meta={ACCOUNT_META[field]}
                  status={status}
                  encryption={secrets.encryption}
                  value={input.value ?? ''}
                  onChange={input.onChange}
                  onRemove={() => onRemove(name)}
                />
                {fieldState.error && <p className="text-xs text-destructive">{fieldState.error.message}</p>}
              </div>
            )}
          />
        )
      })}
    </FormSection>
  )
}
