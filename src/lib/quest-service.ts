export type QuestProgressInput = { currentValue: number; targetValue: number; status: string };

export function questProgressPercent(quest: QuestProgressInput): number {
  if (!Number.isFinite(quest.targetValue) || quest.targetValue <= 0) return 0;
  return Math.min(100, Math.max(0, Math.floor(quest.currentValue / quest.targetValue * 100)));
}

export function isQuestCompletable(currentValue: number, targetValue: number, status: string): boolean {
  return status === 'active' && targetValue > 0 && currentValue >= targetValue;
}

export function isAutoTrackedQuest(category: string, unit: string): boolean {
  return (category === 'english' || category === 'coding') && (unit === 'minutes' || unit === 'sessions');
}

export function questCompletionReward(status: string, xpReward: number) {
  if (!Number.isInteger(xpReward) || xpReward < 0) throw new RangeError('Quest reward must be a non-negative integer');
  return { shouldAward: status !== 'completed' && xpReward > 0, xpAwarded: status === 'completed' ? 0 : xpReward };
}

export function questWindow(type: 'daily' | 'weekly' | 'milestone', now = new Date()) {
  const start = new Date(now);
  if (type === 'daily') start.setHours(0, 0, 0, 0);
  else if (type === 'weekly') {
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  }
  const end = type === 'daily' ? new Date(start.getTime() + 86400000) : type === 'weekly' ? new Date(start.getTime() + 7 * 86400000) : null;
  return { startDate: start, endDate: end };
}
