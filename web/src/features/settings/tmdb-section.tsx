import { FormField } from '@/components/app/form-field'
import { FormSection } from '@/components/app/form-section'
import { NumberInput } from '@/components/app/number-input'
import { Input } from '@/components/ui/input'
import { SecretInput } from '@/features/settings/secret-input'
import { SECRET_META, SECTIONS } from '@/features/settings/sections'
import type { SettingsForm } from '@/features/settings/settings-form'
import type { Settings } from '@/lib/schemas'

type TmdbSectionProps = { secrets: Settings['secrets']; onRemoveSecret: (name: string) => void }

export function TmdbSection({ secrets, onRemoveSecret }: TmdbSectionProps) {
  return (
    <FormSection {...SECTIONS.tmdb}>
      <SecretInput name="tmdbApiKey" meta={SECRET_META.tmdbApiKey} secrets={secrets} onRemove={onRemoveSecret} />
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField<SettingsForm, 'tmdb.language'> name="tmdb.language" label="Idioma" description="Código da TMDB, como pt-BR ou en-US.">
          {(field) => <Input {...field} />}
        </FormField>
        <FormField<SettingsForm, 'tmdb.rps'> name="tmdb.rps" label="Requisições por segundo">
          {(field) => <NumberInput {...field} min={0.1} step={0.1} />}
        </FormField>
        <FormField<SettingsForm, 'tmdb.staleDays'> name="tmdb.staleDays" label="Revalidar nota a cada (dias)">
          {(field) => <NumberInput {...field} min={1} />}
        </FormField>
        <FormField<SettingsForm, 'tmdb.minVotes'>
          name="tmdb.minVotes"
          label="Votos mínimos para nota"
          description="Abaixo disso a nota não aparece nem ordena."
        >
          {(field) => <NumberInput {...field} min={0} />}
        </FormField>
      </div>
    </FormSection>
  )
}
