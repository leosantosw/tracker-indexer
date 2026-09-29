import { useWatch } from 'react-hook-form'

import { FormField } from '@/components/app/form-field'
import { FormSection } from '@/components/app/form-section'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SecretInput } from '@/features/settings/secret-input'
import { providerTokenMeta, SECTIONS } from '@/features/settings/sections'
import type { SettingsForm } from '@/features/settings/settings-form'
import type { Settings } from '@/lib/schemas'

const OFF = 'off'

type DebridSectionProps = { settings: Settings; onRemoveSecret: (name: string) => void }

export function DebridSection({ settings, onRemoveSecret }: DebridSectionProps) {
  const provider = useWatch<SettingsForm, 'debrid.provider'>({ name: 'debrid.provider' })
  const { providers } = settings.debrid

  return (
    <FormSection {...SECTIONS.debrid}>
      <FormField<SettingsForm, 'debrid.provider'> name="debrid.provider" label="Provedor">
        {({ value, onChange, id }) => (
          <Select value={value ?? OFF} onValueChange={(next) => onChange(next === OFF ? null : next)}>
            <SelectTrigger id={id} className="w-full sm:max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={OFF}>Desligado</SelectItem>
              {providers.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
      {providers.map((item) => (
        <div key={item.id} hidden={item.id !== provider}>
          <SecretInput name={item.secret} meta={providerTokenMeta(item)} secrets={settings.secrets} onRemove={onRemoveSecret} />
        </div>
      ))}
    </FormSection>
  )
}
