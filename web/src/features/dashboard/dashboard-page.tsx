import { ActivityCard } from '@/features/activity/activity-card'
import { CatalogCard } from '@/features/dashboard/catalog-card'
import { OverviewCards } from '@/features/dashboard/overview-cards'
import { ReasonAlert } from '@/features/dashboard/reason-alert'
import { TrackersList } from '@/features/trackers/trackers-list'
import { UnmatchedSection } from '@/features/unmatched/unmatched-section'
import { useLoaded } from '@/lib/queries'

export function DashboardPage() {
  const { status, settings } = useLoaded()

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <ReasonAlert job={status.job} />
        <OverviewCards status={status} />
        <CatalogCard stats={status.stats} />
      </div>
      <ActivityCard job={status.job} />
      <TrackersList sources={settings.sources} status={status} />
      <UnmatchedSection />
    </div>
  )
}
