import { describe, expect, it } from 'vitest';
import {
  calculateLevel,
  calculateNextReview,
  calculateSessionXp,
  calculateStreak,
  calculateXpAdjustment,
  getXpProgress,
} from '@/lib/utils';
import { parseWordsCsv, wordsToCsv } from '@/lib/csv';
import { getNextWordReview, getWordStatus } from '@/lib/word-service';
import { codingNoteStatus, nextCodingNoteReview } from '@/lib/coding-note-service';
import { codingTaskXp, nextTaskReviewDate, taskXpForAttempt } from '@/lib/coding-task-service';
import { normalizeProjectProgress, projectDurationHours } from '@/lib/project-service';
import { buildDailyAnalytics, compareMetric, summarizeAnalytics } from '@/lib/analytics';
import { calculateGoalProgress, goalStatusAfterProgress } from '@/lib/goal-service';
import { buildDailyJournalDraft } from '@/lib/journal-service';
import { activityLevel, buildCalendarMonth, calendarWeeks } from '@/lib/calendar';
import { achievementProgress, isAchievementUnlocked, type AchievementMetrics } from '@/lib/achievement-service';
import { parseLeetCodeStats, solvedPercent, validateLeetCodeUsername } from '@/lib/leetcode-adapter';
import { aggregateGitHubEvents, fetchGitHubContributionCalendar, parseContributionCalendar, parseGitHubRepos, validateGitHubUsername } from '@/lib/github-adapter';
import { buildDataBackup, parseDataBackup } from '@/lib/data-transfer';
import { isAutoTrackedQuest, isQuestCompletable, questCompletionReward, questProgressPercent, questWindow } from '@/lib/quest-service';
import { elapsedFocusMinutes, formatTimer, normalizeFocusState, pauseFocusTimer, remainingSeconds, startFocusTimer, type FocusTimerState } from '@/lib/focus-timer';

describe('XP and levels', () => {
  it('calculates progressive levels', () => {
    expect(calculateLevel(0)).toBe(1);
    expect(calculateLevel(99)).toBe(1);
    expect(calculateLevel(100)).toBe(2);
    expect(calculateLevel(400)).toBe(3);
  });

  it('calculates session XP by duration and difficulty', () => {
    expect(calculateSessionXp(25, 'easy')).toBe(25);
    expect(calculateSessionXp(25, 'medium')).toBe(25);
    expect(calculateSessionXp(50, 'medium')).toBe(55);
    expect(calculateSessionXp(90, 'hard')).toBe(95);
  });

  it('reports progress inside the current level', () => {
    const progress = getXpProgress(250);
    expect(progress.currentLevel).toBe(2);
    expect(progress.xpInCurrentLevel).toBe(150);
    expect(progress.xpForNextLevel).toBe(400);
    expect(progress.progressPercent).toBe(50);
  });

  it('calculates correction deltas without double-awarding XP', () => {
    expect(calculateXpAdjustment(25, 55)).toBe(30);
    expect(calculateXpAdjustment(55, 0)).toBe(-55);
    expect(() => calculateXpAdjustment(-1, 0)).toThrow(RangeError);
  });

  it('rejects invalid durations instead of inventing XP', () => {
    expect(() => calculateSessionXp(0)).toThrow(RangeError);
    expect(() => calculateSessionXp(301)).toThrow(RangeError);
    expect(() => calculateSessionXp(1.5)).toThrow(RangeError);
  });
});

describe('spaced repetition', () => {
  it('moves successful first review to one day', () => {
    expect(calculateNextReview(4, 2.5, 0)).toEqual({
      newEaseFactor: 2.5,
      newInterval: 1,
    });
  });

  it('resets failed repetitions and keeps ease above the floor', () => {
    expect(calculateNextReview(0, 1.1, 20)).toEqual({
      newEaseFactor: 1.3,
      newInterval: 0,
    });
  });

  it('rejects invalid review inputs', () => {
    expect(() => calculateNextReview(6, 2.5, 1)).toThrow(RangeError);
    expect(() => calculateNextReview(3, 0, 1)).toThrow(RangeError);
  });
});

describe('streaks', () => {
  it('returns zero for an empty history', () => {
    expect(calculateStreak([])).toEqual({ currentStreak: 0, longestStreak: 0 });
  });

  it('calculates the longest streak from unique dates', () => {
    expect(calculateStreak(['2026-01-01', '2026-01-02', '2026-01-04'])).toEqual({
      currentStreak: 0,
      longestStreak: 2,
    });
  });

  it('ignores duplicate dates and handles invalid calendar dates', () => {
    expect(calculateStreak(['2026-01-01', '2026-01-01', '2026-02-30'])).toEqual({
      currentStreak: 0,
      longestStreak: 1,
    });
  });
});

describe('vocabulary CSV', () => {
  it('round-trips quoted values and tags', () => {
    const csv = wordsToCsv([{ word: 'take off', translation: 'взлетать, "снимать"', example: 'Take off your coat.', tags: ['travel', 'phrasal'] }]);
    expect(parseWordsCsv(csv)).toEqual([{ word: 'take off', translation: 'взлетать, "снимать"', definition: '', example: 'Take off your coat.', partOfSpeech: '', tags: ['travel', 'phrasal'] }]);
  });

  it('requires the two identity columns', () => {
    expect(() => parseWordsCsv('term,meaning\nhello,привет')).toThrow('word and translation');
  });

  it('rejects malformed rows and enforces import limits', () => {
    expect(() => parseWordsCsv('word,translation\n,пусто')).toThrow('empty word or translation');
    expect(() => parseWordsCsv('x'.repeat(2_000_001))).toThrow('2 MB');
  });
});

describe('vocabulary review progression', () => {
  it('does not call a newly added word mastered', () => {
    expect(getWordStatus(0, 0)).toBe('learning');
  });

  it('only labels repeated, long-interval words mastered', () => {
    expect(getWordStatus(4, 60)).toBe('reviewing');
    expect(getWordStatus(5, 29)).toBe('reviewing');
    expect(getWordStatus(5, 30)).toBe('mastered');
  });

  it('schedules a failed review tomorrow while resetting its SM-2 interval', () => {
    const now = new Date('2026-10-12T10:00:00Z');
    const result = getNextWordReview(1, 2.5, 20, now);
    expect(result.newInterval).toBe(0);
    expect(result.nextReviewAt.toISOString()).toBe('2026-10-13T10:00:00.000Z');
    expect(result.status).toBe('learning');
  });
});

describe('coding note review progression', () => {
  it('keeps programming notes in learning until repeated mastery', () => {
    expect(codingNoteStatus(1, 1)).toBe('reviewing');
    expect(codingNoteStatus(4, 30)).toBe('reviewing');
    expect(codingNoteStatus(5, 30)).toBe('mastered');
  });

  it('keeps the answer review separate from the prompt', () => {
    const result = nextCodingNoteReview(0, 2.5, 10, new Date('2026-10-12T10:00:00Z'));
    expect(result.newInterval).toBe(0);
    expect(result.nextReviewAt.toISOString()).toBe('2026-10-13T10:00:00.000Z');
    expect(result.status).toBe('learning');
  });
});

describe('coding tasks', () => {
  it('awards configured XP by task difficulty', () => {
    expect(codingTaskXp('easy')).toBe(20);
    expect(codingTaskXp('medium')).toBe(50);
    expect(codingTaskXp('hard')).toBe(100);
  });

  it('schedules task repetition according to attempt outcome and confidence', () => {
    const now = new Date('2026-10-12T10:00:00Z');
    expect(nextTaskReviewDate('failed', 1, now).toISOString()).toBe('2026-10-13T10:00:00.000Z');
    expect(nextTaskReviewDate('viewed_solution', 2, now).toISOString()).toBe('2026-10-14T10:00:00.000Z');
    expect(nextTaskReviewDate('solved', 5, now).toISOString()).toBe('2026-11-11T10:00:00.000Z');
  });

  it('awards XP only for the first accepted completion', () => {
    expect(taskXpForAttempt('not_started', 'solved', 'medium')).toEqual({ xpAwarded: 50, duplicateSolve: false });
    expect(taskXpForAttempt('completed', 'solved', 'medium')).toEqual({ xpAwarded: 0, duplicateSolve: true });
    expect(taskXpForAttempt('not_started', 'hint', 'hard')).toEqual({ xpAwarded: 0, duplicateSolve: false });
  });
});

describe('projects', () => {
  it('forces completed project progress to 100 percent', () => {
    expect(normalizeProjectProgress('completed', 45)).toBe(100);
    expect(normalizeProjectProgress('in_progress', 45)).toBe(45);
  });

  it('rejects invalid project progress and duration', () => {
    expect(() => normalizeProjectProgress('paused', 101)).toThrow(RangeError);
    expect(() => projectDurationHours(-1)).toThrow(RangeError);
  });

  it('calculates time from session minutes', () => {
    expect(projectDurationHours(95)).toBe(1.6);
  });
});

describe('analytics aggregation', () => {
  it('aggregates real sessions and fills days without activity with zero values', () => {
    const now = new Date('2026-10-12T12:00:00Z');
    const days = buildDailyAnalytics([
      { date: new Date('2026-10-12T09:00:00Z'), type: 'english', durationMinutes: 25, xpAwarded: 25, language: null, projectId: null },
      { date: new Date('2026-10-12T11:00:00Z'), type: 'coding', durationMinutes: 50, xpAwarded: 55, language: 'C#', projectId: 1 },
    ], 7, now);
    expect(days).toHaveLength(7);
    expect(days[6]).toEqual({ date: '2026-10-12', englishMinutes: 25, codingMinutes: 50, xp: 80, sessions: 2 });
    expect(days[0].sessions).toBe(0);
  });

  it('summarizes periods and handles missing previous-period data honestly', () => {
    const summary = summarizeAnalytics([{ date: new Date(), type: 'coding', durationMinutes: 45, xpAwarded: 45, language: 'TypeScript', projectId: null }]);
    expect(summary).toEqual({ englishMinutes: 0, codingMinutes: 45, totalXp: 45, sessionCount: 1 });
    expect(compareMetric(45, 0).percent).toBeNull();
    expect(compareMetric(30, 20)).toEqual({ difference: 10, percent: 50 });
  });
});

describe('goal progress', () => {
  const baseGoal = {
    targetValue: 10,
    currentValue: 1,
    status: 'active',
    type: 'time',
    category: 'coding',
    unit: 'hours',
    deadline: new Date('2026-10-22T00:00:00Z'),
    createdAt: new Date('2026-10-01T00:00:00Z'),
  };

  it('uses tracked progress and caps the display at 100 percent', () => {
    expect(calculateGoalProgress(baseGoal, 12, new Date('2026-10-12T00:00:00Z'))).toMatchObject({
      value: 12, progressPercent: 100, source: 'tracked', forecastWeekly: 0,
    });
  });

  it('keeps manual progress distinguishable from tracked facts', () => {
    expect(calculateGoalProgress({ ...baseGoal, type: 'custom' }, undefined).source).toBe('manual');
  });

  it('does not forecast without a deadline and handles completion state', () => {
    expect(calculateGoalProgress({ ...baseGoal, deadline: null }, 2).forecastWeekly).toBeNull();
    expect(goalStatusAfterProgress('active', 10, 10)).toBe('completed');
    expect(goalStatusAfterProgress('paused', 10, 10)).toBe('paused');
  });
});

describe('journal daily draft', () => {
  it('uses real session and review counts to produce a factual draft', () => {
    const result = buildDailyJournalDraft([
      { type: 'english', category: 'listening', topic: 'Podcasts', durationMinutes: 30, exercisesCompleted: 1, wordsLearned: 4 },
      { type: 'coding', category: 'algorithms', topic: 'Binary search', durationMinutes: 45, exercisesCompleted: 2, wordsLearned: 0 },
    ], { wordReviews: 6, codingNoteReviews: 2, taskAttempts: 1 });
    expect(result.hasActivity).toBe(true);
    expect(result.content).toContain('Английский: 30 мин.');
    expect(result.content).toContain('Программирование: 45 мин.');
    expect(result.content).toContain('Повторений слов: 6.');
    expect(result.content).toContain('Binary search');
  });

  it('does not generate fake activity when the day has no events', () => {
    expect(buildDailyJournalDraft([], { wordReviews: 0, codingNoteReviews: 0, taskAttempts: 0 })).toEqual({
      title: 'День обучения', content: '', hasActivity: false,
    });
  });
});

describe('focus timer', () => {
  const state: FocusTimerState = { durationSeconds: 1500, elapsedBeforeRunSeconds: 0, runningSince: null, status: 'idle', direction: 'coding', category: 'algorithms', topic: '' };

  it('calculates remaining time from timestamps, not accumulated ticks', () => {
    const running = startFocusTimer(state, 1000);
    expect(remainingSeconds(running, 61000)).toBe(1440);
    expect(elapsedFocusMinutes(running, 61000)).toBe(1);
  });

  it('preserves elapsed duration across pause and resume', () => {
    const running = startFocusTimer(state, 1000);
    const paused = pauseFocusTimer(running, 121000);
    expect(paused.status).toBe('paused');
    expect(paused.elapsedBeforeRunSeconds).toBe(120);
    const resumed = startFocusTimer(paused, 500000);
    expect(remainingSeconds(resumed, 560000)).toBe(1320);
  });

  it('marks timer complete and validates persisted state', () => {
    const running = startFocusTimer(state, 1000);
    expect(pauseFocusTimer(running, 1501000).status).toBe('completed');
    expect(normalizeFocusState(state)).toEqual(state);
    expect(normalizeFocusState({ ...state, durationSeconds: -1 })).toBeNull();
    expect(formatTimer(125)).toBe('02:05');
  });
});

describe('activity calendar', () => {
  it('builds a zero-filled month and aggregates only actual session data', () => {
    const days = buildCalendarMonth([
      { date: '2026-10-02', type: 'coding', durationMinutes: 25, category: 'algorithms', topic: null, xpAwarded: 25 },
      { date: '2026-10-02', type: 'english', durationMinutes: 30, category: 'reading', topic: 'Book', xpAwarded: 30 },
      { date: '2026-09-30', type: 'coding', durationMinutes: 50, category: 'x', topic: null, xpAwarded: 55 },
    ], 2026, 9);
    expect(days).toHaveLength(31);
    expect(days[1]).toMatchObject({ date: '2026-10-02', minutes: 55, sessions: 2, xp: 55, level: 3 });
    expect(days[0]).toMatchObject({ minutes: 0, sessions: 0, level: 0 });
  });

  it('creates Monday-first calendar rows and activity thresholds', () => {
    const days = buildCalendarMonth([], 2026, 9);
    const weeks = calendarWeeks(days, 2026, 9);
    expect(weeks[0]).toHaveLength(7);
    expect(weeks[0][0]).toBeNull(); // October 1, 2026 is Thursday.
    expect(activityLevel(0)).toBe(0);
    expect(activityLevel(25)).toBe(2);
    expect(activityLevel(90)).toBe(4);
    expect(() => buildCalendarMonth([], 2026, 12)).toThrow(RangeError);
  });
});

describe('achievement rules', () => {
  const metrics: AchievementMetrics = { sessions: 10, totalMinutes: 300, currentStreak: 7, wordCount: 20, masteredWords: 4, completedProjects: 0, solvedTasks: 3, deepWorkSessions: 2 };
  const rule = { key: 'first_steps', type: 'sessions' as const, target: 1 };

  it('checks real metric thresholds and calculates bounded progress', () => {
    expect(isAchievementUnlocked(rule, metrics)).toBe(true);
    expect(achievementProgress({ ...rule, target: 20 }, metrics)).toBe(50);
    expect(achievementProgress(rule, metrics)).toBe(100);
  });
});

describe('quests', () => {
  it('calculates bounded progress and gates completion on active status', () => {
    expect(questProgressPercent({ currentValue: 5, targetValue: 10, status: 'active' })).toBe(50);
    expect(questProgressPercent({ currentValue: 12, targetValue: 10, status: 'active' })).toBe(100);
    expect(isQuestCompletable(10, 10, 'active')).toBe(true);
    expect(isQuestCompletable(10, 10, 'paused')).toBe(false);
  });

  it('autotracks only supported session metrics', () => {
    expect(isAutoTrackedQuest('coding', 'minutes')).toBe(true);
    expect(isAutoTrackedQuest('english', 'sessions')).toBe(true);
    expect(isAutoTrackedQuest('general', 'tasks')).toBe(false);
  });

  it('creates day and Monday-based week windows', () => {
    const now = new Date('2026-10-14T12:00:00Z');
    expect(questWindow('daily', now).endDate?.getTime()).toBe(questWindow('daily', now).startDate.getTime() + 86400000);
    expect(questWindow('weekly', now).startDate.getDay()).toBe(1);
    expect(questWindow('milestone', now).endDate).toBeNull();
  });

  it('does not award quest XP a second time', () => {
    expect(questCompletionReward('active', 40)).toEqual({ shouldAward: true, xpAwarded: 40 });
    expect(questCompletionReward('completed', 40)).toEqual({ shouldAward: false, xpAwarded: 0 });
    expect(() => questCompletionReward('active', -1)).toThrow(RangeError);
  });
});

describe('LeetCode public adapter', () => {
  const response = { data: { matchedUser: { username: 'learner_1', profile: { ranking: 12345 }, submitStats: { acSubmissionNum: [{ difficulty: 'All', count: 42 }, { difficulty: 'Easy', count: 20 }, { difficulty: 'Medium', count: 18 }, { difficulty: 'Hard', count: 4 }] } }, allQuestionsCount: [{ difficulty: 'All', count: 3200 }] } };

  it('validates public usernames and rejects unsafe characters', () => {
    expect(validateLeetCodeUsername(' learner_1 ')).toBe('learner_1');
    expect(() => validateLeetCodeUsername('user@example.com')).toThrow();
  });

  it('parses only source-provided aggregate counts', () => {
    expect(parseLeetCodeStats(response)).toMatchObject({ username: 'learner_1', totalSolved: 42, easySolved: 20, mediumSolved: 18, hardSolved: 4, totalQuestions: 3200, ranking: 12345 });
  });

  it('reports missing/invalid source data as errors and avoids fake percentages', () => {
    expect(() => parseLeetCodeStats({ data: { matchedUser: null } })).toThrow();
    expect(solvedPercent(10, null)).toBeNull();
    expect(solvedPercent(1, 3)).toBe(33.3);
  });
});

describe('GitHub public adapter', () => {
  it('validates usernames and parses repository fields', () => {
    expect(validateGitHubUsername('octocat')).toBe('octocat');
    expect(() => validateGitHubUsername('bad/name')).toThrow();
    expect(parseGitHubRepos([{ id: 1, name: 'demo', full_name: 'octocat/demo', description: null, language: 'TypeScript', private: false, fork: false, html_url: 'https://github.com/octocat/demo', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z', pushed_at: null }])).toMatchObject([{ id: 1, fullName: 'octocat/demo', language: 'TypeScript' }]);
  });

  it('aggregates only supported public event types by day', () => {
    const activity = aggregateGitHubEvents([
      { type: 'PushEvent', created_at: '2026-10-12T10:00:00Z', repo: { name: 'a' }, payload: { size: 3 } },
      { type: 'PullRequestEvent', created_at: '2026-10-12T11:00:00Z', repo: { name: 'a' }, payload: {} },
      { type: 'IssuesEvent', created_at: '2026-10-13T11:00:00Z', repo: { name: 'b' }, payload: {} },
    ]);
    expect(activity).toEqual([{ date: '2026-10-12', commits: 3, pullRequests: 1, issues: 0, repositories: ['a'] }, { date: '2026-10-13', commits: 0, pullRequests: 0, issues: 1, repositories: ['b'] }]);
  });

  it('parses GraphQL contribution days without inventing missing dates', () => {
    const payload = {
      data: {
        user: {
          contributionsCollection: {
            contributionCalendar: {
              totalContributions: 3,
              weeks: [{ contributionDays: [{ date: '2026-10-12', contributionCount: 3 }] }],
            },
          },
        },
      },
    };
    expect(parseContributionCalendar(payload)).toEqual([{ date: '2026-10-12', contributionCount: 3 }]);
  });

  it('requires a server token for official contributions and handles rate limits', async () => {
    await expect(fetchGitHubContributionCalendar('octocat', undefined, async () => new Response('{}'))).rejects.toThrow('GITHUB_TOKEN');
    await expect(fetchGitHubContributionCalendar('octocat', 'server-token', async () => new Response('', { status: 403, headers: { 'x-ratelimit-remaining': '0' } }))).rejects.toThrow('rate limit');
  });
});

describe('data backup import/export validation', () => {
  const tableNames = ['profile', 'sessions'];
  const columns = { profile: ['id', 'name'], sessions: ['id', 'minutes'] };
  it('round-trips a versioned export with allowed tables and columns', () => {
    const backup = buildDataBackup({ profile: [{ id: 1, name: 'Ada' }], sessions: [{ id: 3, minutes: 25 }] }, new Date('2026-10-13T00:00:00Z'));
    expect(parseDataBackup(JSON.stringify(backup), tableNames, columns)).toEqual(backup);
  });
  it('rejects incompatible table sets and unknown columns', () => {
    const base = { format: 'levelup-sqlite-json', version: 1, exportedAt: '2026-10-13T00:00:00.000Z', tables: { profile: [], sessions: [] } };
    expect(() => parseDataBackup(JSON.stringify({ ...base, tables: { wrong: [] } }), tableNames, columns)).toThrow('tables do not match');
    expect(() => parseDataBackup(JSON.stringify({ ...base, tables: { profile: [{ id: 1, secret: 'x' }], sessions: [] } }), tableNames, columns)).toThrow('Unexpected column');
    expect(() => parseDataBackup(JSON.stringify({ ...base, tables: { profile: [{ id: 1 }], sessions: [] } }), tableNames, columns)).toThrow('Missing column');
  });
  it('rejects malformed and oversized JSON', () => {
    expect(() => parseDataBackup('{', tableNames, columns)).toThrow('valid JSON');
    expect(() => parseDataBackup('x'.repeat(25 * 1024 * 1024 + 1), tableNames, columns)).toThrow('25 MB');
  });
});
