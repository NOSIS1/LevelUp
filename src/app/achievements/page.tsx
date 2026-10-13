import { AchievementGallery } from '@/components/achievements/achievement-gallery';
import { getAchievements } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function AchievementsPage() {
  const achievements = await getAchievements();
  return <AchievementGallery achievements={achievements} />;
}
