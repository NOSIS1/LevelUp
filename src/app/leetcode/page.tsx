import { LeetCodeArena } from '@/components/leetcode/leetcode-arena';
import { getLeetCodeDashboard } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function LeetCodePage() {
  const data = await getLeetCodeDashboard();
  return <LeetCodeArena {...data} />;
}
