import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { CopyButton } from '@/components/app/copy-button'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { useAccessStore } from '@/features/access/access-store'
import { api } from '@/lib/api'
import { randomToken } from '@/lib/random'
import { adminToken } from '@/lib/token'

const MODES = {
  login: {
    title: 'Acesso ao painel',
    description: 'Informe o ADMIN_TOKEN para entrar.',
    submit: 'Entrar',
    autoComplete: 'current-password',
  },
  setup: {
    title: 'Crie o token do painel',
    description: 'Primeiro acesso: defina o ADMIN_TOKEN. Depois disso, o painel só abre com ele. Guarde-o num lugar seguro.',
    submit: 'Criar e entrar',
    autoComplete: 'new-password',
  },
} as const

type Mode = keyof typeof MODES

const tokenSchema = z.object({
  token: z.string().trim().min(1, 'informe o token').regex(/^\S+$/, 'o token não pode ter espaços'),
})

type TokenForm = z.infer<typeof tokenSchema>

function AccessForm({ mode }: { mode: Mode }) {
  const grant = useAccessStore((state) => state.grant)
  const queryClient = useQueryClient()
  const form = useForm<TokenForm>({ resolver: zodResolver(tokenSchema), defaultValues: { token: '' } })
  const { title, description, submit, autoComplete } = MODES[mode]

  async function onSubmit({ token }: TokenForm) {
    try {
      if (mode === 'setup') await api.createAdminToken(token)
      adminToken.set(token)
      grant()
      await queryClient.invalidateQueries()
    } catch (error) {
      toast.error((error as Error).message)
    }
  }

  const tokenError = form.formState.errors.token

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <Field data-invalid={Boolean(tokenError)}>
        <FieldLabel htmlFor="admin-token">ADMIN_TOKEN</FieldLabel>
        <Input
          id="admin-token"
          type={mode === 'setup' ? 'text' : 'password'}
          autoComplete={autoComplete}
          spellCheck={false}
          autoFocus
          aria-invalid={Boolean(tokenError)}
          {...form.register('token')}
        />
        {mode === 'setup' && (
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => form.setValue('token', randomToken(), { shouldValidate: true })}>
              Gerar
            </Button>
            <CopyButton value={() => form.getValues('token')} onFallback={() => form.setFocus('token', { shouldSelect: true })} />
          </div>
        )}
        <FieldError errors={[tokenError]} />
      </Field>
      <DialogFooter>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Spinner data-icon="inline-start" />}
          {submit}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function AccessDialog() {
  const error = useAccessStore((state) => state.error)
  const mode = useQuery({
    queryKey: ['access-mode', error?.tokenRequired],
    enabled: Boolean(error),
    queryFn: async (): Promise<Mode> => {
      if (error?.tokenRequired) return 'login'
      const { required } = await api.setupStatus()
      return required ? 'setup' : 'login'
    },
  })

  return (
    <Dialog open={Boolean(error)}>
      <DialogContent showCloseButton={false} onEscapeKeyDown={(event) => event.preventDefault()} onInteractOutside={(event) => event.preventDefault()}>
        {mode.data ? <AccessForm key={mode.data} mode={mode.data} /> : <Spinner className="mx-auto my-6" />}
      </DialogContent>
    </Dialog>
  )
}
