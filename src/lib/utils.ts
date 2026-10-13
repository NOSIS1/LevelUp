import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// XP and Level calculations
export function calculateLevel(totalXp: number): number {
  if (!Number.isFinite(totalXp) || totalXp < 0) return 1;
  return Math.floor(Math.sqrt(totalXp / 100)) + 1;
}

export function calculateXpForLevel(level: number): number {
  if (!Number.isInteger(level) || level < 1) {
    throw new RangeError('Level must be a positive integer');
  }
  return Math.pow(level - 1, 2) * 100;
}

export function calculateXpForNextLevel(currentLevel: number): number {
  return calculateXpForLevel(currentLevel + 1);
}

export function getXpProgress(totalXp: number): {
  currentLevel: number;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  xpInCurrentLevel: number;
  progressPercent: number;
} {
  const currentLevel = calculateLevel(totalXp);
  const xpForCurrentLevel = calculateXpForLevel(currentLevel);
  const xpForNextLevel = calculateXpForLevel(currentLevel + 1);
  const xpInCurrentLevel = totalXp - xpForCurrentLevel;
  const xpNeededForNextLevel = xpForNextLevel - xpForCurrentLevel;
  const progressPercent = (xpInCurrentLevel / xpNeededForNextLevel) * 100;

  return {
    currentLevel,
    xpForCurrentLevel,
    xpForNextLevel,
    xpInCurrentLevel,
    progressPercent: Math.min(100, Math.max(0, progressPercent)),
  };
}

// Session XP calculations
export function calculateSessionXp(durationMinutes: number, difficulty?: string): number {
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 300) {
    throw new RangeError('Session duration must be an integer between 1 and 300 minutes');
  }

  // One XP per confirmed study minute. A single small focus bonus is awarded
  // for a 50+ minute session; difficulty is not a time multiplier.
  return durationMinutes + (durationMinutes >= 50 ? 5 : 0);
}

export function calculateXpAdjustment(previousAwarded: number, nextAwarded: number): number {
  if (!Number.isInteger(previousAwarded) || previousAwarded < 0 ||
      !Number.isInteger(nextAwarded) || nextAwarded < 0) {
    throw new RangeError('XP values must be non-negative integers');
  }
  return nextAwarded - previousAwarded;
}

// LeetCode XP
export function calculateLeetCodeXp(difficulty: string): number {
  const xpMap: Record<string, number> = {
    Easy: 20,
    Medium: 50,
    Hard: 100,
  };
  return xpMap[difficulty] ?? 0;
}

// SM-2 Algorithm for spaced repetition
export function calculateNextReview(
  quality: number, // 0-5
  easeFactor: number,
  interval: number
): { newEaseFactor: number; newInterval: number } {
  if (!Number.isInteger(quality) || quality < 0 || quality > 5) {
    throw new RangeError('Review quality must be an integer between 0 and 5');
  }
  if (!Number.isFinite(easeFactor) || easeFactor <= 0) {
    throw new RangeError('Ease factor must be a positive finite number');
  }
  if (!Number.isInteger(interval) || interval < 0) {
    throw new RangeError('Review interval must be a non-negative integer');
  }
  let newEaseFactor = easeFactor;
  let newInterval = interval;

  if (quality >= 3) {
    // Correct response
    if (interval === 0) {
      newInterval = 1;
    } else if (interval === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(interval * easeFactor);
    }

    newEaseFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  } else {
    // Incorrect response
    // Reset the repetition sequence. The caller still schedules another try tomorrow.
    newInterval = 0;
    newEaseFactor = easeFactor;
  }

  // Ensure ease factor doesn't go below 1.3
  newEaseFactor = Math.max(1.3, newEaseFactor);

  return { newEaseFactor, newInterval };
}

// Date helpers
export function formatDate(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date * 1000) : date;
  return d.toISOString().split('T')[0];
}

export function getDateString(date?: Date): string {
  return (date || new Date()).toISOString().split('T')[0];
}

export function getDaysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

// Streak calculations
export function calculateStreak(activeDates: string[]): {
  currentStreak: number;
  longestStreak: number;
} {
  if (activeDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  const sorted = [...new Set(activeDates)].filter(isValidDateString).sort().reverse();
  if (sorted.length === 0) return { currentStreak: 0, longestStreak: 0 };
  const today = getDateString();
  const yesterday = getDateString(new Date(Date.now() - 86400000));

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  // Check if there's activity today or yesterday for current streak
  if (sorted[0] === today || sorted[0] === yesterday) {
    let expectedTime = Date.parse(`${sorted[0]}T00:00:00.000Z`);

    for (const date of sorted) {
      const dateTime = Date.parse(`${date}T00:00:00.000Z`);
      if (dateTime === expectedTime) {
        currentStreak++;
        expectedTime -= 86400000; // Go back one day
      } else {
        break;
      }
    }
  }

  // Calculate longest streak
  tempStreak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prevDate = Date.parse(`${sorted[i - 1]}T00:00:00.000Z`);
    const currDate = Date.parse(`${sorted[i]}T00:00:00.000Z`);
    const diff = prevDate - currDate;

    if (diff === 86400000) {
      tempStreak++;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak);
  longestStreak = Math.max(longestStreak, currentStreak);

  return { currentStreak, longestStreak };
}

function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

// Format duration
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}м`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}ч ${mins}м` : `${hours}ч`;
}

// Format number with K, M suffix
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

// Rarity colors
export function getRarityColor(rarity: string): string {
  const colors: Record<string, string> = {
    common: 'text-gray-400',
    rare: 'text-blue-400',
    epic: 'text-purple-400',
    legendary: 'text-yellow-400',
  };
  return colors[rarity] || colors.common;
}

// Difficulty colors
export function getDifficultyColor(difficulty: string): string {
  const colors: Record<string, string> = {
    easy: 'text-green-400',
    Easy: 'text-green-400',
    medium: 'text-yellow-400',
    Medium: 'text-yellow-400',
    hard: 'text-red-400',
    Hard: 'text-red-400',
  };
  return colors[difficulty] || 'text-gray-400';
}

// Status colors
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    not_started: 'text-gray-400',
    in_progress: 'text-blue-400',
    completed: 'text-green-400',
    paused: 'text-yellow-400',
    failed: 'text-red-400',
    active: 'text-blue-400',
    expired: 'text-gray-400',
  };
  return colors[status] || 'text-gray-400';
}
