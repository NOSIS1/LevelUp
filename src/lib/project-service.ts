export type ProjectStatus = 'not_started' | 'in_progress' | 'paused' | 'completed';

export function normalizeProjectProgress(status: ProjectStatus, progress: number): number {
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
    throw new RangeError('Project progress must be an integer from 0 to 100');
  }
  if (status === 'completed') return 100;
  return progress;
}

export function projectDurationHours(minutes: number): number {
  if (!Number.isInteger(minutes) || minutes < 0) throw new RangeError('Project minutes must be a non-negative integer');
  return Math.round(minutes / 60 * 10) / 10;
}
