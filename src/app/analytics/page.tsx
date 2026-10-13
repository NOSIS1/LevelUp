import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';
import { getLearningAnalytics } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const sessions = await getLearningAnalytics(90);
  return <AnalyticsDashboard sessions={sessions} />;
}
