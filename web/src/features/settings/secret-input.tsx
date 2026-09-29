import { Controller, useFormContext } from 'react-hook-form'

import { SecretField, type SecretMeta } from '@/components/app/secret-field'
import type { SettingsForm } from '@/features/settings/settings-form'
import type { Settings } from '@/lib/schemas'

type SecretInputProps = {
  name: string
  meta: SecretMeta
  secrets: Settings['secrets']
  onRemove: (name: string) => void
}

export function SecretInput({ name, meta, secrets, onRemove }: SecretInputProps) {
  const { control } = useFormContext<SettingsForm>()
  const status = secrets.statuses[name] ?? { source: null }

  return (
    <Controller
      control={control}
      name={`secrets.${name}`}
      render={({ field }) => (
        <SecretField
          meta={meta}
          status={status}
          encryption={secrets.encryption}
          value={field.value ?? ''}
          onChange={field.onChange}
          onRemove={() => onRemove(name)}
        />
      )}
    />
  )
}
