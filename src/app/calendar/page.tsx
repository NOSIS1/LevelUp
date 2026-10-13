import { ActivityCalendar } from '@/components/calendar/activity-calendar';
import { getCalendarSessions } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const sessions = await getCalendarSessions();
  return <ActivityCalendar sessions={sessions} />;
}
