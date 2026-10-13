import { JournalBoard } from '@/components/journal/journal-board';
import { getDailyJournalDraft, getJournalEntries } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function JournalPage() {
  const [entries, draft] = await Promise.all([getJournalEntries(), getDailyJournalDraft()]);
  return <JournalBoard entries={entries} draft={draft} />;
}
