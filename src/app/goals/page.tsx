import { Target } from 'lucide-react';
import { GoalBoard } from '@/components/goals/goal-board';
import { getGoals } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function GoalsPage() {
  const goals = await getGoals();
  return (
    <div className="space-y-6">
      <div><h1 className="flex items-center gap-3 text-4xl font-bold"><Target className="h-10 w-10" />Цели</h1><p className="mt-2 text-muted-foreground">Прогресс по учебным целям рассчитывается из записанных занятий; ручные цели помечаются отдельно.</p></div>
      <GoalBoard goals={goals} />
    </div>
  );
}
