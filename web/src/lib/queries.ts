import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, type SettingsPatch } from '@/lib/api'
import type { JobName, Settings } from '@/lib/schemas'

export const queryKeys = {
  status: ['status'] as const,
  settings: ['settings'] as const,
  unmatched: ['unmatched'] as const,
}

export const useStatus = () => useQuery({ queryKey: queryKeys.status, queryFn: api.status })

export const useSettings = () => useQuery({ queryKey: queryKeys.settings, queryFn: api.settings })

function useSettingsMutation<T>(mutationFn: (input: T) => Promise<Settings>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: (settings) => queryClient.setQueryData(queryKeys.settings, settings),
  })
}

export const useSaveSettings = () => useSettingsMutation((patch: SettingsPatch) => api.saveSettings(patch))

export const useResetSettings = () => useSettingsMutation(() => api.resetSettings())

export const useStartJob = () =>
  useMutation({ mutationFn: ({ job, sources }: { job: JobName; sources?: string[] }) => api.startJob(job, { sources }) })

export const useCancelJob = () => useMutation({ mutationFn: api.cancelJob })

export function useClearSource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.clearSource,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.status }),
  })
}

export function useLoaded() {
  const status = useStatus().data
  const settings = useSettings().data
  if (!status || !settings) throw new Error('painel ainda carregando')
  return { status, settings }
}
