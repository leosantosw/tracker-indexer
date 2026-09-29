import { createBrowserRouter } from 'react-router'

import { AppLayout } from '@/layout/app-layout'

export const router = createBrowserRouter(
  [
    {
      element: <AppLayout />,
      children: [
        { index: true, lazy: () => import('@/features/dashboard/dashboard-page').then((page) => ({ Component: page.DashboardPage })) },
        { path: 'configuracoes', lazy: () => import('@/features/settings/settings-page').then((page) => ({ Component: page.SettingsPage })) },
        { path: 'trackers/:name', lazy: () => import('@/features/trackers/tracker-page').then((page) => ({ Component: page.TrackerPage })) },
        { path: 'trackers/:name/adicionar', lazy: () => import('@/features/trackers/tracker-page').then((page) => ({ Component: page.AddTrackerPage })) },
      ],
    },
  ],
  { basename: '/admin' }
)
