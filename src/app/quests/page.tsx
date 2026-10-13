import { QuestBoard } from '@/components/quests/quest-board';
import { getQuests } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function QuestsPage() {
  const quests = await getQuests();
  return <QuestBoard quests={quests} />;
}
