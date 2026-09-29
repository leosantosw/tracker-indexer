import { useId, type ReactNode } from 'react'
import { Controller, useFormContext, type ControllerRenderProps, type FieldPath, type FieldValues } from 'react-hook-form'

import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'

type FormFieldProps<T extends FieldValues, N extends FieldPath<T>> = {
  name: N
  label: string
  description?: string
  children: (field: ControllerRenderProps<T, N> & { id: string; 'aria-invalid': boolean }) => ReactNode
}

export function FormField<T extends FieldValues, N extends FieldPath<T>>({ name, label, description, children }: FormFieldProps<T, N>) {
  const id = useId()
  const { control } = useFormContext<T>()

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          {children({ ...field, id, 'aria-invalid': fieldState.invalid })}
          {description && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  )
}
