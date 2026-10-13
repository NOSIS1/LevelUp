export type AchievementMetrics = {
  sessions: number;
  totalMinutes: number;
  currentStreak: number;
  wordCount: number;
  masteredWords: number;
  completedProjects: number;
  solvedTasks: number;
  deepWorkSessions: number;
};

export type AchievementRule = { key: string; type: keyof AchievementMetrics; target: number };

export function isAchievementUnlocked(rule: AchievementRule, metrics: AchievementMetrics): boolean {
  return metrics[rule.type] >= rule.target;
}

export function achievementProgress(rule: AchievementRule, metrics: AchievementMetrics): number {
  return rule.target > 0 ? Math.min(100, Math.floor(metrics[rule.type] / rule.target * 100)) : 0;
}

export const achievementRules: AchievementRule[] = [
  { key: 'first_steps', type: 'sessions', target: 1 },
  { key: 'getting_serious', type: 'totalMinutes', target: 600 },
  { key: 'consistency', type: 'currentStreak', target: 7 },
  { key: 'word_collector', type: 'wordCount', target: 100 },
  { key: 'hello_world', type: 'completedProjects', target: 1 },
  { key: 'problem_solver', type: 'solvedTasks', target: 50 },
  { key: 'deep_work', type: 'deepWorkSessions', target: 10 },
];
