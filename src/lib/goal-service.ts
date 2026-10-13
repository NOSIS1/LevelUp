export type GoalProgressInput = {
  targetValue: number;
  currentValue: number;
  status: string;
  type: string;
  category: string;
  unit: string;
  deadline: Date | null;
  createdAt: Date;
};

export function calculateGoalProgress(goal: GoalProgressInput, actualValue?: number, now = new Date()) {
  const tracked = actualValue !== undefined && Number.isFinite(actualValue) && actualValue >= 0;
  const value = tracked ? actualValue : goal.currentValue;
  const progressPercent = goal.targetValue > 0 ? Math.min(100, Math.round(value / goal.targetValue * 100)) : 0;
  const daysLeft = goal.deadline ? Math.max(0, Math.ceil((goal.deadline.getTime() - now.getTime()) / 86400000)) : null;
  const daysElapsed = Math.max(1, Math.ceil((now.getTime() - goal.createdAt.getTime()) / 86400000));
  const forecastWeekly = tracked && daysLeft !== null && daysLeft > 0
    ? Math.max(0, (goal.targetValue - value) / daysLeft * 7)
    : null;
  return { value, progressPercent, daysLeft, daysElapsed, forecastWeekly, source: tracked ? 'tracked' as const : 'manual' as const };
}

export function goalStatusAfterProgress(status: string, current: number, target: number): 'active' | 'completed' | 'paused' {
  if (status === 'paused') return 'paused';
  return current >= target ? 'completed' : 'active';
}
