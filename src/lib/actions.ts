'use server';

import { db, schema } from '@/db';
import { eq, desc, gte, sql } from 'drizzle-orm';
import { calculateLevel, calculateSessionXp, calculateXpAdjustment, getDateString } from '@/lib/utils';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { parseWordsCsv, type WordCsvRow } from '@/lib/csv';
import { calculateNextReview } from '@/lib/utils';
import { nextCodingNoteReview } from '@/lib/coding-note-service';
import { nextTaskReviewDate, taskXpForAttempt } from '@/lib/coding-task-service';
import { normalizeProjectProgress, type ProjectStatus } from '@/lib/project-service';
import { subDays } from 'date-fns';
import { calculateGoalProgress } from '@/lib/goal-service';
import { buildDailyJournalDraft, type JournalReview } from '@/lib/journal-service';
import { achievementProgress, achievementRules, isAchievementUnlocked, type AchievementMetrics } from '@/lib/achievement-service';
import { isAutoTrackedQuest, isQuestCompletable, questCompletionReward, questProgressPercent, questWindow } from '@/lib/quest-service';
import { fetchLeetCodeStats, validateLeetCodeUsername } from '@/lib/leetcode-adapter';
import { fetchGitHubContributionCalendar, fetchGitHubEvents, fetchGitHubProfile, validateGitHubUsername } from '@/lib/github-adapter';
import { dateStringInTimezone, localDayBoundsUtc } from '@/lib/timezone';
import { skillStatus, treeDepth } from '@/lib/skill-tree';
import { calculateConfigurableLevel, calculateConfigurableSessionXp, defaultXpSettings, type XpSettings } from '@/lib/xp-settings';

const sessionInputSchema = z.object({
  type: z.enum(['english', 'coding']),
  category: z.string().trim().min(1).max(80),
  topic: z.string().trim().max(200).optional(),
  durationMinutes: z.number().int().min(1).max(300),
  difficulty: z.string().refine((value) => ['easy', 'medium', 'hard'].includes(value)).default('medium'),
  language: z.string().trim().max(80).optional(),
  source: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(5000).optional(),
  wordsLearned: z.number().int().min(0).max(1000).optional(),
  exercisesCompleted: z.number().int().min(0).max(1000).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  date: z.date().optional(),
});

type SessionInput = z.input<typeof sessionInputSchema>;

function updateProfileXpInTransaction(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], amountDelta: number, xpSettings: XpSettings = defaultXpSettings) {
  const profile = tx.select().from(schema.userProfile).limit(1).get();
  if (!profile) throw new Error('Profile is not initialized');
  const totalXp = profile.totalXp + amountDelta;
  if (totalXp < 0) throw new Error('XP correction would make the profile balance negative');
  tx.update(schema.userProfile)
    .set({ totalXp, currentLevel: calculateConfigurableLevel(totalXp, xpSettings), updatedAt: new Date() })
    .where(eq(schema.userProfile.id, profile.id)).run();
}

function getXpSettingsInTransaction(tx: Parameters<Parameters<typeof db.transaction>[0]>[0]): XpSettings {
  const rows = tx.select().from(schema.appSettings).where(sql`${schema.appSettings.key} IN ('xp_per_minute', 'long_session_threshold_minutes', 'long_session_bonus_xp', 'level_base_xp', 'level_exponent')`).all();
  const values = new Map(rows.map((row) => [row.key, Number(row.value)]));
  return {
    xpPerMinute: values.get('xp_per_minute') ?? defaultXpSettings.xpPerMinute,
    longSessionThresholdMinutes: values.get('long_session_threshold_minutes') ?? defaultXpSettings.longSessionThresholdMinutes,
    longSessionBonusXp: values.get('long_session_bonus_xp') ?? defaultXpSettings.longSessionBonusXp,
    levelBaseXp: values.get('level_base_xp') ?? defaultXpSettings.levelBaseXp,
    levelExponent: values.get('level_exponent') ?? defaultXpSettings.levelExponent,
  };
}

function refreshDailyStatistics(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], date: Date) {
  const dateString = getDateString(date);
  const dayStart = Date.parse(`${dateString}T00:00:00.000Z`) / 1000;
  const dayEnd = dayStart + 86400;
  const sessions = tx.select().from(schema.learningSessions)
    .where(sql`${schema.learningSessions.date} >= ${dayStart} AND ${schema.learningSessions.date} < ${dayEnd}`)
    .all();

  const totals = sessions.reduce((acc, session) => ({
    totalMinutes: acc.totalMinutes + session.durationMinutes,
    englishMinutes: acc.englishMinutes + (session.type === 'english' ? session.durationMinutes : 0),
    codingMinutes: acc.codingMinutes + (session.type === 'coding' ? session.durationMinutes : 0),
    xpEarned: acc.xpEarned + session.xpAwarded,
    wordsReviewed: acc.wordsReviewed + session.wordsLearned,
  }), { totalMinutes: 0, englishMinutes: 0, codingMinutes: 0, xpEarned: 0, wordsReviewed: 0 });

  const existing = tx.select().from(schema.dailyStatistics)
    .where(eq(schema.dailyStatistics.date, dateString)).get();
  if (sessions.length === 0) {
    if (existing) tx.delete(schema.dailyStatistics).where(eq(schema.dailyStatistics.id, existing.id)).run();
    return;
  }

  const values = { ...totals, sessionsCount: sessions.length };
  if (existing) {
    tx.update(schema.dailyStatistics).set(values)
      .where(eq(schema.dailyStatistics.id, existing.id)).run();
  } else {
    tx.insert(schema.dailyStatistics).values({ date: dateString, ...values }).run();
  }
}

async function getTimezoneSetting(): Promise<string> {
  const [setting] = await db.select().from(schema.appSettings).where(eq(schema.appSettings.key, 'timezone')).limit(1);
  return setting?.value || 'UTC';
}

// Initialize default profile if not exists
export async function initializeProfile() {
  const profiles = await db.select().from(schema.userProfile).limit(1);

  if (profiles.length === 0) {
    await db.insert(schema.userProfile).values({
      username: 'user',
      displayName: 'Пользователь',
      currentLevel: 1,
      totalXp: 0,
      englishLevel: 'A1',
      targetEnglishLevel: 'B2',
    });

    // Initialize default skills
    await initializeDefaultSkills();
    await initializeDefaultAchievements();
  }

  await initializeProgrammingTree();

  return profiles[0] || (await db.select().from(schema.userProfile).limit(1))[0];
}

async function initializeProgrammingTree() {
  const tree = [
    { name: 'Computer Science', description: 'Фундаментальные знания CS', icon: '🎓', parent: null },
    { name: 'Programming Fundamentals', description: 'Переменные, функции, типы и управление потоком', icon: '🧱', parent: 'Computer Science' },
    { name: 'Data Structures', description: 'Базовые структуры данных и их trade-offs', icon: '🗃️', parent: 'Computer Science' },
    { name: 'Algorithms', description: 'Алгоритмы и оценка сложности', icon: '🧮', parent: 'Data Structures' },
    { name: 'Problem Solving', description: 'Разбор и решение практических задач', icon: '🧩', parent: 'Algorithms' },
    { name: 'C#', description: 'Отдельная ветка практики C#', icon: '🔷', parent: 'Programming Fundamentals' },
    { name: 'Python', description: 'Отдельная ветка практики Python', icon: '🐍', parent: 'Programming Fundamentals' },
    { name: 'JavaScript / TypeScript', description: 'Отдельная ветка web-разработки', icon: '🟨', parent: 'Programming Fundamentals' },
  ];
  const existing = await db.select().from(schema.skills);
  const byName = new Map(existing.map((skill) => [skill.name, skill]));
  for (const [index, item] of tree.entries()) {
    let skill = byName.get(item.name);
    if (!skill) {
      [skill] = await db.insert(schema.skills).values({ name: item.name, category: 'programming', description: item.description, icon: item.icon, displayOrder: index }).returning();
      await db.insert(schema.skillProgress).values({ skillId: skill.id });
      byName.set(item.name, skill);
    }
  }
  for (const item of tree) {
    if (item.parent) {
      const skill = byName.get(item.name);
      const parent = byName.get(item.parent);
      if (skill && parent && skill.parentSkillId !== parent.id) {
        await db.update(schema.skills).set({ parentSkillId: parent.id }).where(eq(schema.skills.id, skill.id));
      }
    }
  }
}

// Initialize default skills
async function initializeDefaultSkills() {
  const englishSkills = [
    { name: 'Vocabulary', category: 'english', description: 'Словарный запас', icon: '📚' },
    { name: 'Grammar', category: 'english', description: 'Грамматика', icon: '📝' },
    { name: 'Listening', category: 'english', description: 'Аудирование', icon: '👂' },
    { name: 'Speaking', category: 'english', description: 'Разговорная практика', icon: '🗣️' },
    { name: 'Reading', category: 'english', description: 'Чтение', icon: '📖' },
    { name: 'Writing', category: 'english', description: 'Письмо', icon: '✍️' },
  ];

  const programmingSkills = [
    { name: 'Fundamentals', category: 'programming', description: 'Основы программирования', icon: '💻' },
    { name: 'Algorithms', category: 'programming', description: 'Алгоритмы и структуры данных', icon: '🧮' },
    { name: 'Problem Solving', category: 'programming', description: 'Решение задач', icon: '🧩' },
    { name: 'Projects', category: 'programming', description: 'Разработка проектов', icon: '🚀' },
    { name: 'Tools & Workflow', category: 'programming', description: 'Инструменты разработчика', icon: '🛠️' },
    { name: 'Computer Science', category: 'programming', description: 'Фундаментальные знания CS', icon: '🎓' },
  ];

  const allSkills = [...englishSkills, ...programmingSkills];

  for (const skill of allSkills) {
    const [inserted] = await db.insert(schema.skills).values(skill).returning();
    await db.insert(schema.skillProgress).values({
      skillId: inserted.id,
      level: 0,
      xp: 0,
      activityScore: 0,
      practiceScore: 0,
      assessmentScore: 0,
      confidenceScore: 0,
      consistencyScore: 0,
    });
  }
}

// Initialize default achievements
async function initializeDefaultAchievements() {
  const achievements = [
    {
      key: 'first_steps',
      title: 'Первые шаги',
      description: 'Завершите первую учебную сессию',
      icon: '👣',
      rarity: 'common',
      category: 'general',
      isSecret: false,
      xpReward: 50,
      condition: JSON.stringify({ type: 'session_count', value: 1 }),
    },
    {
      key: 'getting_serious',
      title: 'Серьёзный подход',
      description: 'Накопите 10 часов обучения',
      icon: '📈',
      rarity: 'common',
      category: 'general',
      isSecret: false,
      xpReward: 100,
      condition: JSON.stringify({ type: 'total_hours', value: 10 }),
    },
    {
      key: 'consistency',
      title: 'Последовательность',
      description: 'Занимайтесь 7 дней подряд',
      icon: '🔥',
      rarity: 'rare',
      category: 'general',
      isSecret: false,
      xpReward: 200,
      condition: JSON.stringify({ type: 'streak', value: 7 }),
    },
    {
      key: 'word_collector',
      title: 'Коллекционер слов',
      description: 'Добавьте 100 слов в словарь',
      icon: '📖',
      rarity: 'common',
      category: 'english',
      isSecret: false,
      xpReward: 100,
      condition: JSON.stringify({ type: 'words_added', value: 100 }),
    },
    {
      key: 'hello_world',
      title: 'Hello, World!',
      description: 'Завершите первый программный проект',
      icon: '👨‍💻',
      rarity: 'rare',
      category: 'coding',
      isSecret: false,
      xpReward: 250,
      condition: JSON.stringify({ type: 'project_completed', value: 1 }),
    },
    {
      key: 'problem_solver',
      title: 'Решатель задач',
      description: 'Решите 50 алгоритмических задач',
      icon: '🧩',
      rarity: 'epic',
      category: 'leetcode',
      isSecret: false,
      xpReward: 500,
      condition: JSON.stringify({ type: 'leetcode_solved', value: 50 }),
    },
    {
      key: 'commit_warrior',
      title: 'Воин коммитов',
      description: 'Делайте коммиты в GitHub 7 разных дней',
      icon: '⚔️',
      rarity: 'rare',
      category: 'github',
      isSecret: false,
      xpReward: 200,
      condition: JSON.stringify({ type: 'github_active_days', value: 7 }),
    },
  ];

  for (const achievement of achievements) {
    await db.insert(schema.achievements).values(achievement).onConflictDoNothing();
  }
}

// Get profile
export async function getProfile() {
  let profile = (await db.select().from(schema.userProfile).limit(1))[0];

  if (!profile) {
    profile = await initializeProfile();
  }

  return profile;
}

// Update profile
export async function updateProfile(data: {
  displayName?: string;
  englishLevel?: string;
  targetEnglishLevel?: string;
}) {
  await db.update(schema.userProfile)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(schema.userProfile.id, 1));

  return getProfile();
}

const profileSettingsSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  englishLevel: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
  targetEnglishLevel: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).nullable(),
  dailyGoalMinutes: z.number().int().min(1).max(1440),
  timezone: z.string().refine((value) => {
    try { new Intl.DateTimeFormat('en-US', { timeZone: value }).format(); return true; }
    catch { return false; }
  }, 'Invalid IANA timezone'),
  xpPerMinute: z.number().positive().max(100),
  longSessionThresholdMinutes: z.number().int().min(1).max(300),
  longSessionBonusXp: z.number().int().min(0).max(10000),
  levelBaseXp: z.number().positive().max(100000),
  levelExponent: z.number().min(1).max(4),
});

async function setAppSetting(key: string, value: string, type: string) {
  const existing = await db.select().from(schema.appSettings).where(eq(schema.appSettings.key, key)).limit(1);
  if (existing[0]) {
    await db.update(schema.appSettings).set({ value, type, updatedAt: new Date() }).where(eq(schema.appSettings.id, existing[0].id));
  } else {
    await db.insert(schema.appSettings).values({ key, value, type });
  }
}

async function getXpSettings(): Promise<XpSettings> {
  const rows = await db.select().from(schema.appSettings).where(sql`${schema.appSettings.key} IN ('xp_per_minute', 'long_session_threshold_minutes', 'long_session_bonus_xp', 'level_base_xp', 'level_exponent')`);
  const values = new Map(rows.map((row) => [row.key, Number(row.value)]));
  return {
    xpPerMinute: values.get('xp_per_minute') ?? defaultXpSettings.xpPerMinute,
    longSessionThresholdMinutes: values.get('long_session_threshold_minutes') ?? defaultXpSettings.longSessionThresholdMinutes,
    longSessionBonusXp: values.get('long_session_bonus_xp') ?? defaultXpSettings.longSessionBonusXp,
    levelBaseXp: values.get('level_base_xp') ?? defaultXpSettings.levelBaseXp,
    levelExponent: values.get('level_exponent') ?? defaultXpSettings.levelExponent,
  };
}

export async function getProfileSettings() {
  const profile = await getProfile();
  const settings = await db.select().from(schema.appSettings).where(sql`${schema.appSettings.key} IN ('daily_goal_minutes', 'timezone')`);
  const values = new Map(settings.map((setting) => [setting.key, setting.value]));
  return {
    displayName: profile.displayName,
    englishLevel: profile.englishLevel,
    targetEnglishLevel: profile.targetEnglishLevel,
    dailyGoalMinutes: Number(values.get('daily_goal_minutes') || 25),
    timezone: values.get('timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    xp: await getXpSettings(),
  };
}

export async function updateProfileSettings(input: z.input<typeof profileSettingsSchema>) {
  const settings = profileSettingsSchema.parse(input);
  await db.update(schema.userProfile).set({ displayName: settings.displayName, englishLevel: settings.englishLevel, targetEnglishLevel: settings.targetEnglishLevel, updatedAt: new Date() }).where(eq(schema.userProfile.id, 1));
  await setAppSetting('daily_goal_minutes', String(settings.dailyGoalMinutes), 'number');
  await setAppSetting('timezone', settings.timezone, 'string');
  await setAppSetting('xp_per_minute', String(settings.xpPerMinute), 'number');
  await setAppSetting('long_session_threshold_minutes', String(settings.longSessionThresholdMinutes), 'number');
  await setAppSetting('long_session_bonus_xp', String(settings.longSessionBonusXp), 'number');
  await setAppSetting('level_base_xp', String(settings.levelBaseXp), 'number');
  await setAppSetting('level_exponent', String(settings.levelExponent), 'number');
  revalidatePath('/settings');
  revalidatePath('/');
  return settings;
}

// Get all skills with progress
export async function getSkillsWithProgress() {
  const skills = await db
    .select({
      id: schema.skills.id,
      name: schema.skills.name,
      category: schema.skills.category,
      description: schema.skills.description,
      icon: schema.skills.icon,
      level: schema.skillProgress.level,
      xp: schema.skillProgress.xp,
      activityScore: schema.skillProgress.activityScore,
      practiceScore: schema.skillProgress.practiceScore,
      assessmentScore: schema.skillProgress.assessmentScore,
      confidenceScore: schema.skillProgress.confidenceScore,
      consistencyScore: schema.skillProgress.consistencyScore,
      lastPracticedAt: schema.skillProgress.lastPracticedAt,
    })
    .from(schema.skills)
    .leftJoin(schema.skillProgress, eq(schema.skills.id, schema.skillProgress.skillId));

  return skills;
}

export async function getProgrammingSkillTree() {
  await initializeProgrammingTree();
  const nodes = await db.select({
    id: schema.skills.id,
    name: schema.skills.name,
    description: schema.skills.description,
    icon: schema.skills.icon,
    parentSkillId: schema.skills.parentSkillId,
    level: schema.skillProgress.level,
    xp: schema.skillProgress.xp,
    category: schema.skills.category,
  }).from(schema.skills).leftJoin(schema.skillProgress, eq(schema.skills.id, schema.skillProgress.skillId));
  return nodes.filter((node) => node.category === 'programming').map((node) => ({
    ...node,
    level: node.level || 0,
    xp: node.xp || 0,
    depth: treeDepth(node.id, nodes.map((item) => ({ ...item, level: item.level || 0, xp: item.xp || 0 }))),
    status: skillStatus(node.level || 0, node.xp || 0),
  }));
}

// Get dashboard statistics
export async function getDashboardStats() {
  const profile = await getProfile();
  const timezone = await getTimezoneSetting();

  // Get total sessions
  const sessions = await db.select().from(schema.learningSessions);
  const totalMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const englishMinutes = sessions.filter(s => s.type === 'english').reduce((sum, s) => sum + s.durationMinutes, 0);
  const codingMinutes = sessions.filter(s => s.type === 'coding').reduce((sum, s) => sum + s.durationMinutes, 0);

  // Get recent sessions
  const recentSessions = await db
    .select()
    .from(schema.learningSessions)
    .orderBy(desc(schema.learningSessions.date))
    .limit(5);

  // Get streak
  const dailyStats = await db
    .select()
    .from(schema.dailyStatistics)
    .orderBy(desc(schema.dailyStatistics.date));

  const activeDates = dailyStats
    .filter(d => d.totalMinutes > 0)
    .map(d => d.date);

  // Calculate streak
  let currentStreak = 0;
  const today = dateStringInTimezone(new Date(), timezone);
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = dateStringInTimezone(yesterdayDate, timezone);

  if (activeDates.length > 0 && (activeDates[0] === today || activeDates[0] === yesterday)) {
    let expectedDate = activeDates[0] === today ? today : yesterday;
    for (const date of activeDates) {
      if (date === expectedDate) {
        currentStreak++;
        const d = new Date(expectedDate);
        d.setDate(d.getDate() - 1);
        expectedDate = d.toISOString().split('T')[0];
      } else {
        break;
      }
    }
  }

  // Get tasks count
  const tasks = await db.select().from(schema.codingTasks);
  const completedTasks = tasks.filter(t => t.status === 'completed').length;

  // Get words count
  const words = await db.select().from(schema.englishWords);

  // Get achievements count
  const achievements = await db.select().from(schema.userAchievements).where(eq(schema.userAchievements.isUnlocked, true));
  const [dailyGoalSetting] = await db.select().from(schema.appSettings).where(eq(schema.appSettings.key, 'daily_goal_minutes')).limit(1);
  const dailyGoalMinutes = Number(dailyGoalSetting?.value || 25);
  const todayBounds = localDayBoundsUtc(new Date(), timezone);
  const todaySessions = sessions.filter((session) => session.date >= todayBounds.start && session.date < todayBounds.end);
  const todayMinutes = todaySessions.reduce((sum, session) => sum + session.durationMinutes, 0);

  return {
    profile,
    totalHours: Math.round(totalMinutes / 60 * 10) / 10,
    englishHours: Math.round(englishMinutes / 60 * 10) / 10,
    codingHours: Math.round(codingMinutes / 60 * 10) / 10,
    sessionsCount: sessions.length,
    currentStreak,
    completedTasks,
    wordsCount: words.length,
    achievementsCount: achievements.length,
    recentSessions,
    timezone,
    dailyGoalMinutes,
    todayMinutes,
    dailyGoalProgress: Math.min(100, Math.round(todayMinutes / dailyGoalMinutes * 100)),
  };
}

// Create learning session
export async function createLearningSession(data: SessionInput) {
  const parsed = sessionInputSchema.parse(data);
  const xpSettings = await getXpSettings();
  const xpAwarded = calculateConfigurableSessionXp(parsed.durationMinutes, xpSettings);
  const sessionDate = parsed.date || new Date();

  const result = db.transaction((tx) => {
    const profile = tx.select().from(schema.userProfile).limit(1).get();
    if (!profile) throw new Error('Profile is not initialized');
    const [session] = tx.insert(schema.learningSessions).values({
      ...parsed,
      topic: parsed.topic || null,
      language: parsed.language || null,
      source: parsed.source || null,
      notes: parsed.notes || null,
      wordsLearned: parsed.wordsLearned || 0,
      exercisesCompleted: parsed.exercisesCompleted || 0,
      date: sessionDate,
      xpAwarded,
    }).returning().all();

    updateProfileXpInTransaction(tx, xpAwarded, xpSettings);
    tx.insert(schema.xpTransactions).values({
      amount: xpAwarded,
      source: 'session',
      sourceId: session.id,
      description: `${parsed.type}: ${parsed.category} (${parsed.durationMinutes} min)`,
    }).run();
    refreshDailyStatistics(tx, sessionDate);

    return { session, xpAwarded, newLevel: calculateConfigurableLevel(profile.totalXp + xpAwarded, xpSettings) > profile.currentLevel };
  });
  revalidatePath('/');
  revalidatePath('/english');
  revalidatePath('/coding');
  await checkAchievements();
  return result;
}

export async function updateLearningSession(id: number, data: SessionInput) {
  if (!Number.isInteger(id) || id < 1) throw new RangeError('Invalid session id');
  const parsed = sessionInputSchema.parse(data);
  const xpSettings = await getXpSettings();

  const result = db.transaction((tx) => {
    const previous = tx.select().from(schema.learningSessions)
      .where(eq(schema.learningSessions.id, id)).get();
    if (!previous) throw new Error('Session not found');
    const nextXp = calculateConfigurableSessionXp(parsed.durationMinutes, xpSettings);
    const nextDate = parsed.date || previous.date;

    tx.update(schema.learningSessions).set({
      ...parsed,
      topic: parsed.topic || null,
      language: parsed.language || null,
      source: parsed.source || null,
      notes: parsed.notes || null,
      wordsLearned: parsed.wordsLearned || 0,
      exercisesCompleted: parsed.exercisesCompleted || 0,
      date: nextDate,
      xpAwarded: nextXp,
    }).where(eq(schema.learningSessions.id, id)).run();

    const delta = calculateXpAdjustment(previous.xpAwarded, nextXp);
    if (delta !== 0) {
      updateProfileXpInTransaction(tx, delta, xpSettings);
      tx.insert(schema.xpTransactions).values({
        amount: delta,
        source: 'correction',
        sourceId: id,
        description: `Session correction #${id}`,
      }).run();
    }
    refreshDailyStatistics(tx, previous.date);
    if (getDateString(previous.date) !== getDateString(nextDate)) refreshDailyStatistics(tx, nextDate);
    return { id, xpDelta: delta };
  });
  revalidatePath('/');
  revalidatePath('/english');
  revalidatePath('/coding');
  await checkAchievements();
  return result;
}

export async function deleteLearningSession(id: number) {
  if (!Number.isInteger(id) || id < 1) throw new RangeError('Invalid session id');

  const result = db.transaction((tx) => {
    const session = tx.select().from(schema.learningSessions)
      .where(eq(schema.learningSessions.id, id)).get();
    if (!session) throw new Error('Session not found');
    tx.delete(schema.learningSessions).where(eq(schema.learningSessions.id, id)).run();
    updateProfileXpInTransaction(tx, calculateXpAdjustment(session.xpAwarded, 0), getXpSettingsInTransaction(tx));
    tx.insert(schema.xpTransactions).values({
      amount: -session.xpAwarded,
      source: 'correction',
      sourceId: id,
      description: `Deleted session #${id}`,
    }).run();
    refreshDailyStatistics(tx, session.date);
    return { deletedId: id, xpRemoved: session.xpAwarded };
  });
  revalidatePath('/');
  revalidatePath('/english');
  revalidatePath('/coding');
  await checkAchievements();
  return result;
}

// Get recent sessions
export async function getRecentSessions(limit: number = 10) {
  return db
    .select()
    .from(schema.learningSessions)
    .orderBy(desc(schema.learningSessions.date))
    .limit(limit);
}

// Get XP history
export async function getXpHistory(days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return db
    .select()
    .from(schema.xpTransactions)
    .where(gte(schema.xpTransactions.createdAt, startDate))
    .orderBy(desc(schema.xpTransactions.createdAt));
}

const wordSchema = z.object({
  word: z.string().trim().min(1).max(200),
  translation: z.string().trim().min(1).max(500),
  definition: z.string().trim().max(1000).optional(),
  example: z.string().trim().max(1000).optional(),
  partOfSpeech: z.string().trim().max(80).optional(),
  pronunciation: z.string().trim().max(200).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  category: z.string().trim().max(80).optional(),
});

export async function getWords(search = '', dueOnly = false) {
  const rows = await db.select().from(schema.englishWords).orderBy(desc(schema.englishWords.createdAt));
  const query = search.trim().toLowerCase();
  return rows.filter((row) => {
    const matchesSearch = !query || row.word.toLowerCase().includes(query) || row.translation.toLowerCase().includes(query);
    const matchesDue = !dueOnly || !row.nextReviewAt || row.nextReviewAt <= new Date();
    return matchesSearch && matchesDue;
  });
}

export async function addWord(input: z.input<typeof wordSchema>) {
  const word = wordSchema.parse(input);
  const duplicate = await db.select({ id: schema.englishWords.id }).from(schema.englishWords)
    .where(sql`lower(${schema.englishWords.word}) = lower(${word.word})`).limit(1);
  if (duplicate.length > 0) throw new Error('This word already exists');
  const [created] = await db.insert(schema.englishWords).values({
    ...word,
    wordKey: word.word.toLocaleLowerCase('en-US'),
    definition: word.definition || null,
    example: word.example || null,
    partOfSpeech: word.partOfSpeech || null,
    pronunciation: word.pronunciation || null,
    tags: JSON.stringify(word.tags || []),
    interval: 0,
    nextReviewAt: new Date(),
  }).returning();
  revalidatePath('/english');
  await checkAchievements();
  return created;
}

export async function reviewWord(wordId: number, quality: number) {
  if (!Number.isInteger(wordId) || wordId < 1) throw new RangeError('Invalid word id');
  if (!Number.isInteger(quality) || quality < 0 || quality > 5) throw new RangeError('Quality must be 0-5');
  const result = db.transaction((tx) => {
    const word = tx.select().from(schema.englishWords).where(eq(schema.englishWords.id, wordId)).get();
    if (!word) throw new Error('Word not found');
    const review = calculateNextReview(quality, word.easeFactor, word.interval);
    const nextReviewAt = new Date(Date.now() + Math.max(1, review.newInterval) * 86400000);
    const correct = quality >= 3;
    const correctCount = word.correctCount + (correct ? 1 : 0);
    const incorrectCount = word.incorrectCount + (correct ? 0 : 1);
    const status = correctCount >= 5 && review.newInterval >= 30 ? 'mastered' : correctCount > 0 ? 'reviewing' : 'learning';
    tx.update(schema.englishWords).set({
      correctCount, incorrectCount, easeFactor: review.newEaseFactor, interval: review.newInterval,
      nextReviewAt, lastReviewedAt: new Date(), status,
    }).where(eq(schema.englishWords.id, wordId)).run();
    tx.insert(schema.wordReviews).values({ wordId, quality, previousInterval: word.interval, newInterval: review.newInterval }).run();
    return { wordId, nextReviewAt, status };
  });
  revalidatePath('/english');
  await checkAchievements();
  return result;
}

export async function deleteWord(wordId: number) {
  if (!Number.isInteger(wordId) || wordId < 1) throw new RangeError('Invalid word id');
  const result = db.transaction((tx) => {
    const word = tx.select({ id: schema.englishWords.id }).from(schema.englishWords)
      .where(eq(schema.englishWords.id, wordId)).get();
    if (!word) throw new Error('Word not found');
    tx.delete(schema.wordReviews).where(eq(schema.wordReviews.wordId, wordId)).run();
    tx.delete(schema.englishWords).where(eq(schema.englishWords.id, wordId)).run();
    return { deletedId: wordId };
  });
  revalidatePath('/english');
  return result;
}

export async function importWordsCsv(csv: string) {
  const rows = parseWordsCsv(csv);
  let imported = 0;
  let skipped = 0;
  for (const row of rows) {
    try {
      await addWord(row);
      imported += 1;
    } catch (error) {
      if (error instanceof Error && (error.message.includes('already exists') || error.message.includes('UNIQUE constraint failed'))) skipped += 1;
      else throw error;
    }
  }
  return { imported, skipped };
}

const codingNoteSchema = z.object({
  prompt: z.string().trim().min(1).max(5000),
  answer: z.string().trim().min(1).max(10000),
  language: z.string().trim().max(80).optional(),
  topic: z.string().trim().max(200).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
});

export async function getCodingNotes(search = '', dueOnly = false) {
  const rows = await db.select().from(schema.codingNotes).orderBy(desc(schema.codingNotes.updatedAt));
  const query = search.trim().toLowerCase();
  return rows.filter((row) => {
    const matchesSearch = !query || `${row.prompt} ${row.answer} ${row.topic || ''} ${row.language || ''}`.toLowerCase().includes(query);
    const matchesDue = !dueOnly || !row.nextReviewAt || row.nextReviewAt <= new Date();
    return matchesSearch && matchesDue;
  });
}

export async function addCodingNote(input: z.input<typeof codingNoteSchema>) {
  const note = codingNoteSchema.parse(input);
  const [created] = await db.insert(schema.codingNotes).values({
    ...note,
    language: note.language || null,
    topic: note.topic || null,
    tags: JSON.stringify(note.tags || []),
    nextReviewAt: new Date(),
  }).returning();
  revalidatePath('/coding');
  return created;
}

export async function reviewCodingNote(noteId: number, quality: number) {
  if (!Number.isInteger(noteId) || noteId < 1) throw new RangeError('Invalid coding note id');
  if (!Number.isInteger(quality) || quality < 0 || quality > 5) throw new RangeError('Quality must be 0-5');
  const result = db.transaction((tx) => {
    const note = tx.select().from(schema.codingNotes).where(eq(schema.codingNotes.id, noteId)).get();
    if (!note) throw new Error('Coding note not found');
    const review = nextCodingNoteReview(quality, note.easeFactor, note.interval);
    const correct = quality >= 3;
    const correctCount = note.correctCount + (correct ? 1 : 0);
    const incorrectCount = note.incorrectCount + (correct ? 0 : 1);
    tx.update(schema.codingNotes).set({
      correctCount,
      incorrectCount,
      easeFactor: review.newEaseFactor,
      interval: review.newInterval,
      nextReviewAt: review.nextReviewAt,
      lastReviewedAt: new Date(),
      status: correctCount >= 5 && review.newInterval >= 30 ? 'mastered' : correctCount > 0 ? 'reviewing' : 'learning',
      updatedAt: new Date(),
    }).where(eq(schema.codingNotes.id, noteId)).run();
    tx.insert(schema.codingNoteReviews).values({
      noteId,
      quality,
      previousInterval: note.interval,
      newInterval: review.newInterval,
    }).run();
    return { noteId, nextReviewAt: review.nextReviewAt, status: review.status };
  });
  revalidatePath('/coding');
  return result;
}

export async function deleteCodingNote(noteId: number) {
  if (!Number.isInteger(noteId) || noteId < 1) throw new RangeError('Invalid coding note id');
  const result = db.transaction((tx) => {
    const note = tx.select({ id: schema.codingNotes.id }).from(schema.codingNotes)
      .where(eq(schema.codingNotes.id, noteId)).get();
    if (!note) throw new Error('Coding note not found');
    tx.delete(schema.codingNoteReviews).where(eq(schema.codingNoteReviews.noteId, noteId)).run();
    tx.delete(schema.codingNotes).where(eq(schema.codingNotes.id, noteId)).run();
    return { deletedId: noteId };
  });
  revalidatePath('/coding');
  return result;
}

const codingTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  type: z.string().refine((value) => ['algorithm', 'exercise', 'project', 'bug_fix', 'refactor'].includes(value)),
  difficulty: z.string().refine((value) => ['easy', 'medium', 'hard'].includes(value)),
  language: z.string().trim().max(80).optional(),
  topic: z.string().trim().max(100).optional(),
  solutionUrl: z.string().trim().url().optional().or(z.literal('')),
});

export async function getCodingTasks() {
  return db.select().from(schema.codingTasks).orderBy(desc(schema.codingTasks.createdAt));
}

export async function addCodingTask(input: z.input<typeof codingTaskSchema>) {
  const task = codingTaskSchema.parse(input);
  const tags = task.topic ? [task.topic] : [];
  const [created] = await db.insert(schema.codingTasks).values({
    title: task.title,
    description: task.description || null,
    type: task.type,
    difficulty: task.difficulty,
    language: task.language || null,
    topics: JSON.stringify(tags),
    solutionUrl: task.solutionUrl || null,
    status: 'not_started',
  }).returning();
  revalidatePath('/coding');
  return created;
}

export async function getCodingTaskHistory(taskId: number) {
  if (!Number.isInteger(taskId) || taskId < 1) throw new RangeError('Invalid task id');
  return db.select().from(schema.codingTaskReviews)
    .where(eq(schema.codingTaskReviews.taskId, taskId))
    .orderBy(desc(schema.codingTaskReviews.reviewedAt));
}

export async function recordCodingTaskAttempt(taskId: number, outcome: 'solved' | 'hint' | 'viewed_solution' | 'failed' | 'repeat', confidence: number, notes = '') {
  if (!Number.isInteger(taskId) || taskId < 1) throw new RangeError('Invalid task id');
  if (!Number.isInteger(confidence) || confidence < 1 || confidence > 5) throw new RangeError('Confidence must be 1-5');
  if (notes.length > 3000) throw new RangeError('Attempt notes must not exceed 3000 characters');

  const result = db.transaction((tx) => {
    const task = tx.select().from(schema.codingTasks).where(eq(schema.codingTasks.id, taskId)).get();
    if (!task) throw new Error('Task not found');
    const [previous] = tx.select().from(schema.codingTaskReviews).where(eq(schema.codingTaskReviews.taskId, taskId)).all();
    const award = taskXpForAttempt(task.status, outcome, task.difficulty as 'easy' | 'medium' | 'hard');
    const xpAwarded = award.xpAwarded;
    if (xpAwarded > 0) {
      updateProfileXpInTransaction(tx, xpAwarded, getXpSettingsInTransaction(tx));
      tx.insert(schema.xpTransactions).values({
        amount: xpAwarded,
        source: 'coding_task',
        sourceId: taskId,
        description: `Solved coding task: ${task.title}`,
      }).run();
    }
    const nextReviewAt = nextTaskReviewDate(outcome, confidence);
    tx.insert(schema.codingTaskReviews).values({ taskId, outcome, confidence, notes: notes || null }).run();
    tx.update(schema.codingTasks).set({
      status: outcome === 'solved' ? 'completed' : outcome === 'failed' ? 'in_progress' : task.status,
      attempts: task.attempts + 1,
      timeSpentMinutes: task.timeSpentMinutes,
      solvedAt: outcome === 'solved' ? new Date() : task.solvedAt,
      nextReviewAt,
      confidenceLevel: confidence,
      xpAwarded: task.xpAwarded + xpAwarded,
      updatedAt: new Date(),
    }).where(eq(schema.codingTasks.id, taskId)).run();
    return { taskId, xpAwarded, nextReviewAt, duplicateSolve: award.duplicateSolve, attempts: task.attempts + 1, previousAttempts: (previous ? 1 : 0) };
  });
  revalidatePath('/coding');
  return result;
}

export async function deleteCodingTask(taskId: number) {
  if (!Number.isInteger(taskId) || taskId < 1) throw new RangeError('Invalid task id');
  const result = db.transaction((tx) => {
    const task = tx.select().from(schema.codingTasks).where(eq(schema.codingTasks.id, taskId)).get();
    if (!task) throw new Error('Task not found');
    // Removing the task reverses its original one-time award. Attempt history remains attached
    // until deletion, then is removed in the same transaction.
    if (task.xpAwarded > 0) {
      updateProfileXpInTransaction(tx, -task.xpAwarded, getXpSettingsInTransaction(tx));
      tx.insert(schema.xpTransactions).values({
        amount: -task.xpAwarded,
        source: 'correction',
        sourceId: taskId,
        description: `Deleted coding task: ${task.title}`,
      }).run();
    }
    tx.delete(schema.codingTaskReviews).where(eq(schema.codingTaskReviews.taskId, taskId)).run();
    tx.delete(schema.codingTasks).where(eq(schema.codingTasks.id, taskId)).run();
    return { deletedId: taskId, xpRemoved: task.xpAwarded };
  });
  revalidatePath('/coding');
  revalidatePath('/');
  return result;
}

const projectSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(5000).optional(),
  language: z.string().trim().max(80).optional(),
  status: z.string().refine((value) => ['not_started', 'in_progress', 'paused', 'completed'].includes(value)),
  difficulty: z.string().refine((value) => ['easy', 'medium', 'hard'].includes(value)).optional(),
  githubUrl: z.string().trim().url().optional().or(z.literal('')),
  completionPercent: z.number().int().min(0).max(100),
});

export async function getProjects() {
  const rows = await db.select().from(schema.projects).orderBy(desc(schema.projects.updatedAt));
  const sessions = await db.select({ projectId: schema.learningSessions.projectId, durationMinutes: schema.learningSessions.durationMinutes })
    .from(schema.learningSessions);
  const tasks = await db.select({ projectId: schema.codingTasks.projectId, count: sql<number>`count(*)` })
    .from(schema.codingTasks).groupBy(schema.codingTasks.projectId);
  const taskCounts = new Map(tasks.filter((row) => row.projectId !== null).map((row) => [row.projectId as number, row.count]));
  return rows.map((project) => {
    const minutes = sessions.filter((session) => session.projectId === project.id).reduce((sum, session) => sum + session.durationMinutes, 0);
    return { ...project, trackedHours: Math.round(minutes / 60 * 10) / 10, linkedTasks: taskCounts.get(project.id) || 0 };
  });
}

export async function createProject(input: z.input<typeof projectSchema>) {
  const data = projectSchema.parse(input);
  const completionPercent = normalizeProjectProgress(data.status as ProjectStatus, data.completionPercent);
  const now = new Date();
  const [project] = await db.insert(schema.projects).values({
    name: data.name,
    description: data.description || null,
    language: data.language || null,
    status: data.status,
    difficulty: data.difficulty || null,
    githubUrl: data.githubUrl || null,
    completionPercent,
    startedAt: data.status === 'not_started' ? null : now,
    completedAt: data.status === 'completed' ? now : null,
  }).returning();
  revalidatePath('/projects');
  await checkAchievements();
  return project;
}

export async function updateProject(projectId: number, input: z.input<typeof projectSchema>) {
  if (!Number.isInteger(projectId) || projectId < 1) throw new RangeError('Invalid project id');
  const data = projectSchema.parse(input);
  const completionPercent = normalizeProjectProgress(data.status as ProjectStatus, data.completionPercent);
  const previous = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).get();
  if (!previous) throw new Error('Project not found');
  const now = new Date();
  await db.update(schema.projects).set({
    name: data.name,
    description: data.description || null,
    language: data.language || null,
    status: data.status,
    difficulty: data.difficulty || null,
    githubUrl: data.githubUrl || null,
    completionPercent,
    startedAt: previous.startedAt || (data.status === 'not_started' ? null : now),
    completedAt: data.status === 'completed' ? previous.completedAt || now : null,
    updatedAt: now,
  }).where(eq(schema.projects.id, projectId));
  revalidatePath('/projects');
  await checkAchievements();
  return { projectId, completionPercent };
}

export async function deleteProject(projectId: number) {
  if (!Number.isInteger(projectId) || projectId < 1) throw new RangeError('Invalid project id');
  const result = db.transaction((tx) => {
    const project = tx.select().from(schema.projects).where(eq(schema.projects.id, projectId)).get();
    if (!project) throw new Error('Project not found');
    // Preserve learning sessions and tasks; only detach them from the deleted project.
    tx.update(schema.learningSessions).set({ projectId: null }).where(eq(schema.learningSessions.projectId, projectId)).run();
    tx.update(schema.codingTasks).set({ projectId: null, updatedAt: new Date() }).where(eq(schema.codingTasks.projectId, projectId)).run();
    tx.delete(schema.projectSkills).where(eq(schema.projectSkills.projectId, projectId)).run();
    tx.delete(schema.projects).where(eq(schema.projects.id, projectId)).run();
    return { deletedId: projectId, preservedSessions: true, preservedTasks: true };
  });
  revalidatePath('/projects');
  revalidatePath('/coding');
  await checkAchievements();
  return result;
}

export async function getLearningAnalytics(days = 30) {
  if (!Number.isInteger(days) || days < 7 || days > 365) throw new RangeError('Analytics period must be between 7 and 365 days');
  const start = subDays(new Date(), days - 1);
  return db.select({
    date: schema.learningSessions.date,
    type: schema.learningSessions.type,
    durationMinutes: schema.learningSessions.durationMinutes,
    xpAwarded: schema.learningSessions.xpAwarded,
    language: schema.learningSessions.language,
    projectId: schema.learningSessions.projectId,
  }).from(schema.learningSessions).where(gte(schema.learningSessions.date, start))
    .orderBy(schema.learningSessions.date);
}

const goalSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(3000).optional(),
  type: z.string().refine((value) => ['time', 'count', 'skill_level', 'custom'].includes(value)),
  category: z.string().refine((value) => ['english', 'coding', 'leetcode', 'github', 'general'].includes(value)),
  targetValue: z.number().positive().max(1000000),
  unit: z.string().trim().min(1).max(40),
  timeframe: z.string().refine((value) => ['daily', 'weekly', 'monthly', 'custom'].includes(value)),
  priority: z.string().refine((value) => ['low', 'medium', 'high'].includes(value)),
  deadline: z.date().nullable().optional(),
});

async function getActualGoalValue(goal: typeof schema.goals.$inferSelect): Promise<number | undefined> {
  const trackedCategory = goal.category === 'english' || goal.category === 'coding';
  if (goal.type === 'time' && trackedCategory) {
    const sessions = await db.select({ durationMinutes: schema.learningSessions.durationMinutes, type: schema.learningSessions.type, date: schema.learningSessions.date })
      .from(schema.learningSessions);
    const filtered = sessions.filter((session) => session.type === goal.category && session.date >= goal.createdAt && (!goal.deadline || session.date <= goal.deadline));
    return filtered.reduce((sum, session) => sum + session.durationMinutes, 0) / 60;
  }
  if (goal.type === 'count' && (goal.category === 'english' || goal.category === 'coding')) {
    const sessions = await db.select({ type: schema.learningSessions.type, date: schema.learningSessions.date }).from(schema.learningSessions);
    return sessions.filter((session) => session.type === goal.category && session.date >= goal.createdAt && (!goal.deadline || session.date <= goal.deadline)).length;
  }
  return undefined;
}

export async function getGoals() {
  const goals = await db.select().from(schema.goals).orderBy(desc(schema.goals.createdAt));
  return Promise.all(goals.map(async (goal) => {
    const actual = await getActualGoalValue(goal);
    return { ...goal, progress: calculateGoalProgress(goal, actual) };
  }));
}

export async function createGoal(input: z.input<typeof goalSchema>) {
  const goal = goalSchema.parse(input);
  const [created] = await db.insert(schema.goals).values({
    ...goal,
    description: goal.description || null,
    deadline: goal.deadline || null,
    currentValue: 0,
    status: 'active',
  }).returning();
  revalidatePath('/goals');
  return created;
}

export async function updateGoal(goalId: number, input: z.input<typeof goalSchema>) {
  if (!Number.isInteger(goalId) || goalId < 1) throw new RangeError('Invalid goal id');
  const goal = goalSchema.parse(input);
  const [existing] = await db.select().from(schema.goals).where(eq(schema.goals.id, goalId)).limit(1);
  if (!existing) throw new Error('Goal not found');
  await db.update(schema.goals).set({
    ...goal,
    description: goal.description || null,
    deadline: goal.deadline || null,
    updatedAt: new Date(),
  }).where(eq(schema.goals.id, goalId));
  revalidatePath('/goals');
  return { goalId };
}

export async function setManualGoalProgress(goalId: number, value: number) {
  if (!Number.isInteger(goalId) || goalId < 1) throw new RangeError('Invalid goal id');
  if (!Number.isFinite(value) || value < 0 || value > 1000000) throw new RangeError('Progress must be a non-negative number');
  const [goal] = await db.select().from(schema.goals).where(eq(schema.goals.id, goalId)).limit(1);
  if (!goal) throw new Error('Goal not found');
  if ((goal.type === 'time' || goal.type === 'count') && (goal.category === 'english' || goal.category === 'coding')) {
    throw new Error('This goal is tracked automatically from learning sessions');
  }
  await db.update(schema.goals).set({ currentValue: value, updatedAt: new Date() }).where(eq(schema.goals.id, goalId));
  revalidatePath('/goals');
  return { goalId, currentValue: value };
}

export async function changeGoalStatus(goalId: number, status: 'active' | 'paused') {
  if (!Number.isInteger(goalId) || goalId < 1) throw new RangeError('Invalid goal id');
  await db.update(schema.goals).set({ status, updatedAt: new Date() }).where(eq(schema.goals.id, goalId));
  revalidatePath('/goals');
  return { goalId, status };
}

export async function deleteGoal(goalId: number) {
  if (!Number.isInteger(goalId) || goalId < 1) throw new RangeError('Invalid goal id');
  await db.transaction((tx) => {
    tx.delete(schema.goalSkills).where(eq(schema.goalSkills.goalId, goalId)).run();
    tx.delete(schema.goals).where(eq(schema.goals.id, goalId)).run();
  });
  revalidatePath('/goals');
  return { deletedId: goalId };
}

const journalInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().trim().max(160).optional(),
  content: z.string().trim().min(1).max(10000),
  learned: z.string().trim().max(5000).optional(),
  challenges: z.string().trim().max(5000).optional(),
  plans: z.string().trim().max(5000).optional(),
  mood: z.string().trim().max(40).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
});

export async function getJournalEntries(search = '') {
  const entries = await db.select().from(schema.journalEntries).orderBy(desc(schema.journalEntries.date), desc(schema.journalEntries.updatedAt));
  const query = search.trim().toLowerCase();
  if (!query) return entries;
  return entries.filter((entry) => [entry.title, entry.content, entry.learned, entry.challenges, entry.plans, entry.tags].some((field) => field?.toLowerCase().includes(query)));
}

export async function getDailyJournalDraft(date = new Date()) {
  const timezone = await getTimezoneSetting();
  const day = dateStringInTimezone(date, timezone);
  const bounds = localDayBoundsUtc(date, timezone);
  const start = Math.floor(bounds.start.getTime() / 1000);
  const end = Math.floor(bounds.end.getTime() / 1000);
  const sessions = await db.select({
    type: schema.learningSessions.type,
    category: schema.learningSessions.category,
    topic: schema.learningSessions.topic,
    durationMinutes: schema.learningSessions.durationMinutes,
    exercisesCompleted: schema.learningSessions.exercisesCompleted,
    wordsLearned: schema.learningSessions.wordsLearned,
  }).from(schema.learningSessions).where(sql`${schema.learningSessions.date} >= ${start} AND ${schema.learningSessions.date} < ${end}`);
  const wordReviews = await db.select({ count: sql<number>`count(*)` }).from(schema.wordReviews)
    .where(sql`${schema.wordReviews.reviewedAt} >= ${start} AND ${schema.wordReviews.reviewedAt} < ${end}`).get();
  const codingNoteReviews = await db.select({ count: sql<number>`count(*)` }).from(schema.codingNoteReviews)
    .where(sql`${schema.codingNoteReviews.reviewedAt} >= ${start} AND ${schema.codingNoteReviews.reviewedAt} < ${end}`).get();
  const taskAttempts = await db.select({ count: sql<number>`count(*)` }).from(schema.codingTaskReviews)
    .where(sql`${schema.codingTaskReviews.reviewedAt} >= ${start} AND ${schema.codingTaskReviews.reviewedAt} < ${end}`).get();
  const reviews: JournalReview = {
    wordReviews: wordReviews?.count || 0,
    codingNoteReviews: codingNoteReviews?.count || 0,
    taskAttempts: taskAttempts?.count || 0,
  };
  return { ...buildDailyJournalDraft(sessions, reviews), date: day };
}

export async function saveJournalEntry(input: z.input<typeof journalInputSchema>) {
  const entry = journalInputSchema.parse(input);
  const existing = await db.select().from(schema.journalEntries).where(eq(schema.journalEntries.date, entry.date)).limit(1);
  const values = {
    date: entry.date,
    title: entry.title || null,
    content: entry.content,
    learned: entry.learned || null,
    challenges: entry.challenges || null,
    plans: entry.plans || null,
    mood: entry.mood || null,
    tags: JSON.stringify(entry.tags || []),
    autoGenerated: false,
    updatedAt: new Date(),
  };
  let saved;
  if (existing[0]) {
    [saved] = await db.update(schema.journalEntries).set(values).where(eq(schema.journalEntries.id, existing[0].id)).returning();
  } else {
    [saved] = await db.insert(schema.journalEntries).values(values).returning();
  }
  revalidatePath('/journal');
  return saved;
}

export async function deleteJournalEntry(entryId: number) {
  if (!Number.isInteger(entryId) || entryId < 1) throw new RangeError('Invalid journal entry id');
  const [deleted] = await db.delete(schema.journalEntries).where(eq(schema.journalEntries.id, entryId)).returning({ id: schema.journalEntries.id });
  if (!deleted) throw new Error('Journal entry not found');
  revalidatePath('/journal');
  return deleted;
}

export async function getCalendarSessions() {
  const timezone = await getTimezoneSetting();
  const start = new Date();
  start.setDate(start.getDate() - 365);
  const rows = await db.select({
    date: schema.learningSessions.date,
    type: schema.learningSessions.type,
    durationMinutes: schema.learningSessions.durationMinutes,
    category: schema.learningSessions.category,
    topic: schema.learningSessions.topic,
    xpAwarded: schema.learningSessions.xpAwarded,
  }).from(schema.learningSessions).where(gte(schema.learningSessions.date, start)).orderBy(schema.learningSessions.date);
  return rows.map((row) => ({ ...row, date: dateStringInTimezone(row.date, timezone) }));
}

async function getAchievementMetrics(): Promise<AchievementMetrics> {
  const timezone = await getTimezoneSetting();
  const [sessions, words, masteredWords, projects, tasks, deepWork] = await Promise.all([
    db.select().from(schema.learningSessions),
    db.select().from(schema.englishWords),
    db.select().from(schema.englishWords).where(eq(schema.englishWords.status, 'mastered')),
    db.select().from(schema.projects),
    db.select().from(schema.codingTasks).where(eq(schema.codingTasks.status, 'completed')),
    db.select().from(schema.learningSessions).where(gte(schema.learningSessions.durationMinutes, 50)),
  ]);
  const daily = await db.select().from(schema.dailyStatistics).orderBy(desc(schema.dailyStatistics.date));
  const activeDates = daily.filter((row) => row.totalMinutes > 0).map((row) => row.date);
  let currentStreak = 0;
  let expected = dateStringInTimezone(new Date(), timezone);
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = dateStringInTimezone(yesterdayDate, timezone);
  if (activeDates[0] === expected || activeDates[0] === yesterday) {
    expected = activeDates[0];
    for (const date of activeDates) {
      if (date !== expected) break;
      currentStreak += 1;
      const next = new Date(`${expected}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() - 1);
      expected = next.toISOString().slice(0, 10);
    }
  }
  return {
    sessions: sessions.length,
    totalMinutes: sessions.reduce((sum, session) => sum + session.durationMinutes, 0),
    currentStreak,
    wordCount: words.length,
    masteredWords: masteredWords.length,
    completedProjects: projects.filter((project) => project.status === 'completed').length,
    solvedTasks: tasks.length,
    deepWorkSessions: deepWork.length,
  };
}

export async function getAchievements() {
  await getProfile();
  await initializeDefaultAchievements();
  const metrics = await getAchievementMetrics();
  const definitions = await db.select().from(schema.achievements);
  const unlocked = await db.select().from(schema.userAchievements).where(eq(schema.userAchievements.isUnlocked, true));
  const unlockedKeys = new Set(unlocked.map((row) => row.achievementId));
  return definitions.map((definition) => {
    const rule = achievementRules.find((candidate) => candidate.key === definition.key);
    const progress = rule ? achievementProgress(rule, metrics) : 0;
    return { ...definition, progress, isUnlocked: unlockedKeys.has(definition.id) };
  });
}

export async function checkAchievements() {
  await initializeDefaultAchievements();
  const metrics = await getAchievementMetrics();
  const definitions = await db.select().from(schema.achievements);
  const unlocked = await db.select().from(schema.userAchievements).where(eq(schema.userAchievements.isUnlocked, true));
  const unlockedIds = new Set(unlocked.map((row) => row.achievementId));
  const newlyUnlocked: string[] = [];
  db.transaction((tx) => {
    for (const definition of definitions) {
      const rule = achievementRules.find((candidate) => candidate.key === definition.key);
      if (!rule || unlockedIds.has(definition.id) || !isAchievementUnlocked(rule, metrics)) continue;
      tx.insert(schema.userAchievements).values({ achievementId: definition.id, isUnlocked: true, progress: 100 }).run();
      updateProfileXpInTransaction(tx, definition.xpReward, getXpSettingsInTransaction(tx));
      tx.insert(schema.xpTransactions).values({ amount: definition.xpReward, source: 'achievement', sourceId: definition.id, description: `Achievement unlocked: ${definition.title}` }).run();
      newlyUnlocked.push(definition.key);
    }
  });
  revalidatePath('/achievements');
  revalidatePath('/');
  return newlyUnlocked;
}

const questInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(3000),
  type: z.string().refine((value) => ['daily', 'weekly', 'milestone'].includes(value)),
  category: z.string().refine((value) => ['english', 'coding', 'general'].includes(value)),
  targetValue: z.number().positive().max(100000),
  unit: z.string().refine((value) => ['minutes', 'sessions', 'tasks', 'words', 'custom'].includes(value)),
  difficulty: z.string().refine((value) => ['easy', 'medium', 'hard'].includes(value)),
  xpReward: z.number().int().min(0).max(10000),
});

export async function getQuests() {
  const quests = await db.select().from(schema.quests).orderBy(desc(schema.quests.createdAt));
  const sessions = await db.select({ date: schema.learningSessions.date, type: schema.learningSessions.type, durationMinutes: schema.learningSessions.durationMinutes })
    .from(schema.learningSessions);
  const calculated = quests.map((quest) => {
    let currentValue = quest.currentValue;
    if (isAutoTrackedQuest(quest.category, quest.unit)) {
      const matching = sessions.filter((session) => session.type === quest.category && session.date >= quest.startDate && session.date < quest.endDate);
      currentValue = quest.unit === 'minutes'
        ? matching.reduce((sum, session) => sum + session.durationMinutes, 0)
        : matching.length;
    }
    return { ...quest, currentValue, progressPercent: questProgressPercent({ currentValue, targetValue: quest.targetValue, status: quest.status }), autoTracked: isAutoTrackedQuest(quest.category, quest.unit) };
  });
  for (const quest of calculated) {
    if (quest.status === 'active' && quest.autoTracked && isQuestCompletable(quest.currentValue, quest.targetValue, quest.status)) {
      await awardQuestOnce(quest.id);
      quest.status = 'completed';
      quest.completedAt = new Date();
    }
  }
  return calculated;
}

export async function createQuest(input: z.input<typeof questInputSchema>) {
  const data = questInputSchema.parse(input);
  const type = data.type as 'daily' | 'weekly' | 'milestone';
  const window = questWindow(type);
  const endDate = window.endDate || new Date(window.startDate.getTime() + 3650 * 86400000);
  const [quest] = await db.insert(schema.quests).values({
    title: data.title,
    description: data.description,
    type,
    category: data.category,
    targetValue: data.targetValue,
    currentValue: 0,
    unit: data.unit,
    difficulty: data.difficulty,
    xpReward: data.xpReward,
    startDate: window.startDate,
    endDate,
  }).returning();
  revalidatePath('/quests');
  return quest;
}

export async function confirmQuestCompletion(questId: number) {
  if (!Number.isInteger(questId) || questId < 1) throw new RangeError('Invalid quest id');
  const result = db.transaction((tx) => {
    const quest = tx.select().from(schema.quests).where(eq(schema.quests.id, questId)).get();
    if (!quest) throw new Error('Quest not found');
    if (quest.status === 'completed') return { questId, alreadyCompleted: true, xpAwarded: 0 };
    if (quest.status !== 'active') throw new Error('Quest cannot be completed while paused or expired');
    if (isAutoTrackedQuest(quest.category, quest.unit)) {
      const sessions = tx.select({ date: schema.learningSessions.date, type: schema.learningSessions.type, durationMinutes: schema.learningSessions.durationMinutes })
        .from(schema.learningSessions).all();
      const matching = sessions.filter((session) => session.type === quest.category && session.date >= quest.startDate && session.date < quest.endDate);
      const currentValue = quest.unit === 'minutes' ? matching.reduce((sum, session) => sum + session.durationMinutes, 0) : matching.length;
      if (!isQuestCompletable(currentValue, quest.targetValue, quest.status)) throw new Error('Quest target has not been reached yet');
    }
    tx.update(schema.quests).set({ status: 'completed', completedAt: new Date(), currentValue: quest.targetValue }).where(eq(schema.quests.id, questId)).run();
    const reward = questCompletionReward(quest.status, quest.xpReward);
    if (reward.shouldAward) {
      updateProfileXpInTransaction(tx, reward.xpAwarded, getXpSettingsInTransaction(tx));
      tx.insert(schema.xpTransactions).values({ amount: reward.xpAwarded, source: 'quest', sourceId: questId, description: `Quest completed: ${quest.title}` }).run();
    }
    return { questId, alreadyCompleted: false, xpAwarded: reward.xpAwarded };
  });
  revalidatePath('/quests');
  revalidatePath('/');
  return result;
}

function awardQuestOnce(questId: number) {
  return db.transaction((tx) => {
    const quest = tx.select().from(schema.quests).where(eq(schema.quests.id, questId)).get();
    if (!quest || quest.status !== 'active') return false;
    tx.update(schema.quests).set({ status: 'completed', completedAt: new Date(), currentValue: quest.targetValue }).where(eq(schema.quests.id, questId)).run();
    const reward = questCompletionReward(quest.status, quest.xpReward);
    if (reward.shouldAward) {
      updateProfileXpInTransaction(tx, reward.xpAwarded, getXpSettingsInTransaction(tx));
      tx.insert(schema.xpTransactions).values({ amount: reward.xpAwarded, source: 'quest', sourceId: questId, description: `Quest completed: ${quest.title}` }).run();
    }
    return true;
  });
}

export async function toggleQuestPause(questId: number) {
  if (!Number.isInteger(questId) || questId < 1) throw new RangeError('Invalid quest id');
  const quest = await db.select().from(schema.quests).where(eq(schema.quests.id, questId)).get();
  if (!quest || !['active', 'paused'].includes(quest.status)) throw new Error('Quest cannot be paused or resumed');
  const status = quest.status === 'paused' ? 'active' : 'paused';
  await db.update(schema.quests).set({ status }).where(eq(schema.quests.id, questId));
  revalidatePath('/quests');
  return { questId, status };
}

export async function deleteQuest(questId: number) {
  if (!Number.isInteger(questId) || questId < 1) throw new RangeError('Invalid quest id');
  const [deleted] = await db.delete(schema.quests).where(eq(schema.quests.id, questId)).returning({ id: schema.quests.id });
  if (!deleted) throw new Error('Quest not found');
  revalidatePath('/quests');
  return { deletedId: questId };
}

export async function getLeetCodeDashboard() {
  const connection = await db.select().from(schema.leetcodeIntegration).limit(1);
  if (!connection[0]?.isConnected) return { connection: null, snapshots: [], tasks: [] };
  const [snapshots, tasks] = await Promise.all([
    db.select().from(schema.leetcodeSnapshots).where(eq(schema.leetcodeSnapshots.username, connection[0].username)).orderBy(desc(schema.leetcodeSnapshots.capturedAt)).limit(90),
    db.select().from(schema.leetcodeTasks).orderBy(desc(schema.leetcodeTasks.updatedAt)),
  ]);
  return { connection: connection[0], snapshots, tasks };
}

export async function connectLeetCode(usernameInput: string) {
  const username = validateLeetCodeUsername(usernameInput);
  const stats = await fetchLeetCodeStats(username);
  const existing = await db.select().from(schema.leetcodeIntegration).limit(1);
  let connection;
  if (existing[0]) {
    [connection] = await db.update(schema.leetcodeIntegration).set({ username: stats.username, isConnected: true, lastSyncAt: new Date(), totalSolved: stats.totalSolved, easySolved: stats.easySolved, mediumSolved: stats.mediumSolved, hardSolved: stats.hardSolved, ranking: stats.ranking, syncError: null, updatedAt: new Date() }).where(eq(schema.leetcodeIntegration.id, existing[0].id)).returning();
  } else {
    [connection] = await db.insert(schema.leetcodeIntegration).values({ username: stats.username, isConnected: true, lastSyncAt: new Date(), totalSolved: stats.totalSolved, easySolved: stats.easySolved, mediumSolved: stats.mediumSolved, hardSolved: stats.hardSolved, ranking: stats.ranking, syncError: null }).returning();
  }
  await db.insert(schema.leetcodeSnapshots).values({ ...stats });
  revalidatePath('/leetcode');
  return connection;
}

export async function syncLeetCode() {
  const [connection] = await db.select().from(schema.leetcodeIntegration).where(eq(schema.leetcodeIntegration.isConnected, true)).limit(1);
  if (!connection) throw new Error('Сначала подключите публичный username LeetCode');
  try {
    const stats = await fetchLeetCodeStats(connection.username);
    db.transaction((tx) => {
      tx.insert(schema.leetcodeSnapshots).values({ ...stats }).run();
      tx.update(schema.leetcodeIntegration).set({ totalSolved: stats.totalSolved, easySolved: stats.easySolved, mediumSolved: stats.mediumSolved, hardSolved: stats.hardSolved, ranking: stats.ranking, lastSyncAt: new Date(), syncError: null, updatedAt: new Date() }).where(eq(schema.leetcodeIntegration.id, connection.id)).run();
    });
    revalidatePath('/leetcode');
    return stats;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка синхронизации';
    await db.update(schema.leetcodeIntegration).set({ syncError: message, updatedAt: new Date() }).where(eq(schema.leetcodeIntegration.id, connection.id));
    revalidatePath('/leetcode');
    throw error;
  }
}

export async function disconnectLeetCode() {
  const [connection] = await db.select().from(schema.leetcodeIntegration).limit(1);
  if (connection) {
    await db.delete(schema.leetcodeSnapshots).where(eq(schema.leetcodeSnapshots.username, connection.username));
    await db.delete(schema.leetcodeIntegration).where(eq(schema.leetcodeIntegration.id, connection.id));
  }
  revalidatePath('/leetcode');
  return { disconnected: true };
}

const leetCodeTaskSchema = z.object({
  slug: z.string().trim().min(1).max(160).regex(/^[a-z0-9-]+$/i),
  title: z.string().trim().min(1).max(200),
  difficulty: z.string().refine((value) => ['Easy', 'Medium', 'Hard'].includes(value)),
  topics: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  solvedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().trim().max(5000).optional(),
  status: z.string().refine((value) => ['not_started', 'solved', 'review', 'mastered'].includes(value)),
});

export async function addLeetCodeTask(input: z.input<typeof leetCodeTaskSchema>) {
  const task = leetCodeTaskSchema.parse(input);
  const [created] = await db.insert(schema.leetcodeTasks).values({
    ...task,
    topics: JSON.stringify(task.topics),
    solvedAt: task.solvedAt ? new Date(`${task.solvedAt}T12:00:00`) : null,
    notes: task.notes || null,
    nextReviewAt: task.status === 'review' ? new Date() : null,
  }).returning();
  revalidatePath('/leetcode');
  return created;
}

export async function deleteLeetCodeTask(taskId: number) {
  if (!Number.isInteger(taskId) || taskId < 1) throw new RangeError('Invalid LeetCode task id');
  const result = db.transaction((tx) => {
    const task = tx.select().from(schema.leetcodeTasks).where(eq(schema.leetcodeTasks.id, taskId)).get();
    if (!task) throw new Error('LeetCode task not found');
    if (task.xpAwarded > 0) {
      updateProfileXpInTransaction(tx, -task.xpAwarded, getXpSettingsInTransaction(tx));
      tx.insert(schema.xpTransactions).values({ amount: -task.xpAwarded, source: 'correction', sourceId: taskId, description: `Deleted LeetCode task: ${task.title}` }).run();
    }
    tx.delete(schema.leetcodeTasks).where(eq(schema.leetcodeTasks.id, taskId)).run();
    return { deletedId: taskId, xpRemoved: task.xpAwarded };
  });
  revalidatePath('/leetcode');
  revalidatePath('/');
  return result;
}

export async function getGitHubDashboard() {
  const [connection] = await db.select().from(schema.githubIntegration).limit(1);
  if (!connection?.isConnected) return { connection: null, repositories: [], activity: [], contributions: [] };
  const [repositories, activity] = await Promise.all([
    db.select().from(schema.githubRepositories).orderBy(desc(schema.githubRepositories.updatedAt)),
    db.select().from(schema.githubActivity).orderBy(desc(schema.githubActivity.date)).limit(90),
  ]);
  const contributions = await db.select().from(schema.githubContributionDays)
    .where(eq(schema.githubContributionDays.username, connection.username))
    .orderBy(schema.githubContributionDays.date);
  return { connection, repositories, activity, contributions };
}

export async function syncGitHub(usernameInput: string) {
  const username = validateGitHubUsername(usernameInput);
  const token = process.env.GITHUB_TOKEN;
  let profile;
  let activity;
  let contributions: Awaited<ReturnType<typeof fetchGitHubContributionCalendar>> = [];
  try {
    [profile, activity] = await Promise.all([
      fetchGitHubProfile(username, { token }),
      fetchGitHubEvents(username, { token }),
    ]);
    if (token) {
      try { contributions = await fetchGitHubContributionCalendar(username, token); }
      catch { contributions = []; }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'GitHub synchronization failed';
    const [existing] = await db.select().from(schema.githubIntegration).limit(1);
    if (existing) await db.update(schema.githubIntegration).set({ syncError: message, updatedAt: new Date() }).where(eq(schema.githubIntegration.id, existing.id));
    revalidatePath('/github');
    throw error;
  }
  const committed = db.transaction((tx) => {
    const existing = tx.select().from(schema.githubIntegration).limit(1).get();
    let connectionId: number;
    if (existing) {
      connectionId = existing.id;
      tx.update(schema.githubIntegration).set({ username: profile.username, isConnected: true, lastSyncAt: new Date(), totalRepos: profile.repositories.length, totalCommits: activity.reduce((sum, day) => sum + day.commits, 0), syncError: null, updatedAt: new Date() }).where(eq(schema.githubIntegration.id, existing.id)).run();
    } else {
      const [created] = tx.insert(schema.githubIntegration).values({ username: profile.username, isConnected: true, lastSyncAt: new Date(), totalRepos: profile.repositories.length, totalCommits: activity.reduce((sum, day) => sum + day.commits, 0), syncError: null }).returning().all();
      connectionId = created.id;
    }
    const oldRepos = tx.select().from(schema.githubRepositories).all();
    const oldById = new Map(oldRepos.map((repo) => [repo.githubId, repo]));
    let addedRepos = 0;
    for (const repo of profile.repositories) {
      const previous = oldById.get(repo.id);
      if (!previous) addedRepos += 1;
      tx.insert(schema.githubRepositories).values({
        githubId: repo.id, name: repo.name, fullName: repo.fullName, description: repo.description,
        language: repo.language, isPrivate: repo.isPrivate, isFork: repo.isFork,
        isTracked: previous?.isTracked ?? false, htmlUrl: repo.htmlUrl, projectId: previous?.projectId ?? null,
        createdAt: repo.createdAt, updatedAt: repo.updatedAt, pushedAt: repo.pushedAt, syncedAt: new Date(),
      }).onConflictDoUpdate({ target: schema.githubRepositories.githubId, set: {
        name: repo.name, fullName: repo.fullName, description: repo.description, language: repo.language,
        isPrivate: repo.isPrivate, isFork: repo.isFork, htmlUrl: repo.htmlUrl,
        createdAt: repo.createdAt, updatedAt: repo.updatedAt, pushedAt: repo.pushedAt, syncedAt: new Date(),
      } }).run();
    }
    for (const day of activity) {
      tx.insert(schema.githubActivity).values({ date: day.date, commits: day.commits, pullRequests: day.pullRequests, issues: day.issues, repositories: JSON.stringify(day.repositories), syncedAt: new Date() })
        .onConflictDoUpdate({ target: schema.githubActivity.date, set: { commits: day.commits, pullRequests: day.pullRequests, issues: day.issues, repositories: JSON.stringify(day.repositories), syncedAt: new Date() } }).run();
    }
    if (contributions.length > 0) {
      for (const day of contributions) {
        tx.insert(schema.githubContributionDays).values({ username: profile.username, date: day.date, contributionCount: day.contributionCount, source: 'github-graphql', syncedAt: new Date() })
          .onConflictDoUpdate({ target: [schema.githubContributionDays.username, schema.githubContributionDays.date], set: { contributionCount: day.contributionCount, source: 'github-graphql', syncedAt: new Date() } }).run();
      }
    } else {
      for (const day of activity) {
        tx.insert(schema.githubContributionDays).values({ username: profile.username, date: day.date, contributionCount: day.commits + day.pullRequests + day.issues, source: 'github-public-events', syncedAt: new Date() })
          .onConflictDoNothing().run();
      }
    }
    return { connectionId, addedRepos, repositories: profile.repositories.length, activeDays: activity.length, commits: activity.reduce((sum, day) => sum + day.commits, 0) };
  });
  revalidatePath('/github');
  revalidatePath('/');
  return committed;
}

export async function setGitHubRepositoryTracked(repositoryId: number, tracked: boolean) {
  if (!Number.isInteger(repositoryId) || repositoryId < 1) throw new RangeError('Invalid GitHub repository id');
  const [repo] = await db.select().from(schema.githubRepositories).where(eq(schema.githubRepositories.id, repositoryId)).limit(1);
  if (!repo) throw new Error('Repository not found');
  await db.update(schema.githubRepositories).set({ isTracked: tracked }).where(eq(schema.githubRepositories.id, repositoryId));
  revalidatePath('/github');
  return { repositoryId, tracked };
}

export async function disconnectGitHub() {
  const [connection] = await db.select().from(schema.githubIntegration).limit(1);
  if (connection) {
    await db.delete(schema.githubActivity);
    await db.delete(schema.githubRepositories);
    await db.delete(schema.githubIntegration).where(eq(schema.githubIntegration.id, connection.id));
  }
  revalidatePath('/github');
  return { disconnected: true };
}
