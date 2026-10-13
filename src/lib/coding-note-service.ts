import { calculateNextReview } from '@/lib/utils';

export function codingNoteStatus(correctCount: number, interval: number): 'learning' | 'reviewing' | 'mastered' {
  if (correctCount >= 5 && interval >= 30) return 'mastered';
  if (correctCount > 0) return 'reviewing';
  return 'learning';
}

export function nextCodingNoteReview(quality: number, easeFactor: number, interval: number, now = new Date()) {
  const result = calculateNextReview(quality, easeFactor, interval);
  const nextReviewAt = new Date(now.getTime() + Math.max(1, result.newInterval) * 86400000);
  return {
    ...result,
    nextReviewAt,
    status: codingNoteStatus(quality >= 3 ? 1 : 0, result.newInterval),
  };
}
