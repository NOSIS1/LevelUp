export type TaskDifficulty = 'easy' | 'medium' | 'hard';

export function codingTaskXp(difficulty: TaskDifficulty): number {
  const values: Record<TaskDifficulty, number> = { easy: 20, medium: 50, hard: 100 };
  return values[difficulty];
}

export function taskXpForAttempt(status: string, outcome: string, difficulty: TaskDifficulty) {
  const duplicateSolve = outcome === 'solved' && status === 'completed';
  return {
    xpAwarded: outcome === 'solved' && status !== 'completed' ? codingTaskXp(difficulty) : 0,
    duplicateSolve,
  };
}

export function nextTaskReviewDate(outcome: string, confidence: number, now = new Date()): Date {
  const days = outcome === 'failed' ? 1 : outcome === 'viewed_solution' ? 2 : outcome === 'hint' ? 3 : confidence >= 4 ? 30 : 7;
  return new Date(now.getTime() + days * 86400000);
}
