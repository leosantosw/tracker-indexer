import { useId } from 'react'

import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'

type SwitchFieldProps = {
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

export function SwitchField({ label, description, checked, onCheckedChange }: SwitchFieldProps) {
  const id = useId()
  return (
    <Field orientation="horizontal" className="justify-between gap-4">
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {description && <FieldDescription>{description}</FieldDescription>}
      </FieldContent>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </Field>
  )
}
