import type { ComponentProps } from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type NumberInputProps = Omit<ComponentProps<typeof Input>, 'type' | 'value' | 'onChange'> & {
  value: number | null
  onChange: (value: number | null) => void
}

export function NumberInput({ value, onChange, className, ...props }: NumberInputProps) {
  return (
    <Input
      type="number"
      className={cn('tabular-nums', className)}
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
      {...props}
    />
  )
}
