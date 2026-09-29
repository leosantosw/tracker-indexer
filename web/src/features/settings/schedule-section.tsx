import { useState } from 'react'
import { Controller, useFormContext, useWatch } from 'react-hook-form'

import { FormField } from '@/components/app/form-field'
import { FormSection } from '@/components/app/form-section'
import { NumberInput } from '@/components/app/number-input'
import { SwitchField } from '@/components/app/switch-field'
import { FieldDescription } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { SECTIONS } from '@/features/settings/sections'
import type { SettingsForm } from '@/features/settings/settings-form'

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const UNITS = { minutes: 1, hours: 60 } as const

type Unit = keyof typeof UNITS

const selected = 'data-[state=on]:bg-primary data-[state=on]:text-primary-foreground'

function IntervalInput({ value, onChange, id }: { value: number | null; onChange: (value: number | null) => void; id: string }) {
  const [unit, setUnit] = useState<Unit>(value && value % 60 === 0 ? 'hours' : 'minutes')
  const toMinutes = (amount: number | null, of: Unit) => (amount === null ? null : Math.round(amount * UNITS[of]))

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">A cada</span>
      <NumberInput
        id={id}
        className="w-28"
        min={1}
        value={value === null ? null : value / UNITS[unit]}
        onChange={(amount) => onChange(toMinutes(amount, unit))}
      />
      <Select
        value={unit}
        onValueChange={(next: Unit) => {
          setUnit(next)
          onChange(toMinutes(value === null ? null : value / UNITS[unit], next))
        }}
      >
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="minutes">minutos</SelectItem>
          <SelectItem value="hours">horas</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

export function ScheduleSection({ nextRun }: { nextRun: string | null }) {
  const { control } = useFormContext<SettingsForm>()
  const [enabled, mode] = useWatch<SettingsForm, ['schedule.enabled', 'schedule.mode']>({ name: ['schedule.enabled', 'schedule.mode'] })

  return (
    <FormSection {...SECTIONS.schedule}>
      <Controller
        control={control}
        name="schedule.enabled"
        render={({ field }) => (
          <SwitchField
            label="Atualizar o catálogo automaticamente"
            description="Busca torrents novos e, no fim, capas e notas. Só roda com o servidor no ar."
            checked={field.value}
            onCheckedChange={field.onChange}
          />
        )}
      />
      {enabled && (
        <div className="space-y-6">
          <Controller
            control={control}
            name="schedule.mode"
            render={({ field }) => (
              <ToggleGroup
                type="single"
                variant="outline"
                value={field.value}
                onValueChange={(value) => value && field.onChange(value)}
              >
                <ToggleGroupItem value="daily" className={selected}>
                  Em horário fixo
                </ToggleGroupItem>
                <ToggleGroupItem value="interval" className={selected}>
                  A cada intervalo
                </ToggleGroupItem>
              </ToggleGroup>
            )}
          />
          {mode === 'daily' ? (
            <div className="space-y-5">
              <FormField<SettingsForm, 'schedule.time'> name="schedule.time" label="Horário" description="No relógio do servidor.">
                {(field) => <Input {...field} type="time" className="max-w-40 tabular-nums" />}
              </FormField>
              <FormField<SettingsForm, 'schedule.days'> name="schedule.days" label="Dias">
                {({ value, onChange, id }) => (
                  <ToggleGroup
                    id={id}
                    type="multiple"
                    variant="outline"
                    spacing={2}
                    className="flex-wrap"
                    value={value.map(String)}
                    onValueChange={(days) => days.length && onChange(days.map(Number).sort())}
                  >
                    {DAYS.map((label, day) => (
                      <ToggleGroupItem key={day} value={String(day)} className={`size-11 ${selected}`}>
                        {label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                )}
              </FormField>
            </div>
          ) : (
            <FormField<SettingsForm, 'schedule.everyMinutes'>
              name="schedule.everyMinutes"
              label="Intervalo"
              description="Contado a partir do fim da execução anterior, então uma nunca atropela a outra."
            >
              {({ value, onChange, id }) => <IntervalInput id={id} value={value} onChange={onChange} />}
            </FormField>
          )}
          {nextRun && <FieldDescription>Próxima execução: {nextRun}.</FieldDescription>}
        </div>
      )}
    </FormSection>
  )
}
