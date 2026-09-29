import { FormSection } from '@/components/app/form-section'
import { SecretInput } from '@/features/settings/secret-input'
import { SECRET_META, SECTIONS } from '@/features/settings/sections'
import type { Settings } from '@/lib/schemas'

type AccessSectionProps = { secrets: Settings['secrets']; onRemoveSecret: (name: string) => void }

export function AccessSection({ secrets, onRemoveSecret }: AccessSectionProps) {
  return (
    <FormSection {...SECTIONS.access} stacked>
      <div className="grid gap-4 md:grid-cols-2">
        <SecretInput name="adminToken" meta={SECRET_META.adminToken} secrets={secrets} onRemove={onRemoveSecret} />
        <SecretInput name="apiToken" meta={SECRET_META.apiToken} secrets={secrets} onRemove={onRemoveSecret} />
      </div>
    </FormSection>
  )
}
