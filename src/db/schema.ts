import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// User Profile
export const userProfile = sqliteTable('user_profile', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull(),
  displayName: text('display_name').notNull(),
  currentLevel: integer('current_level').notNull().default(1),
  totalXp: integer('total_xp').notNull().default(0),
  englishLevel: text('english_level').notNull().default('A1'),
  targetEnglishLevel: text('target_english_level'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Skills
export const skills = sqliteTable('skills', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  category: text('category').notNull(), // 'english' | 'programming' | 'general'
  description: text('description'),
  icon: text('icon'),
  parentSkillId: integer('parent_skill_id'),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Skill Progress
export const skillProgress = sqliteTable('skill_progress', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  skillId: integer('skill_id').notNull().references(() => skills.id),
  level: integer('level').notNull().default(0),
  xp: integer('xp').notNull().default(0),
  activityScore: real('activity_score').notNull().default(0),
  practiceScore: real('practice_score').notNull().default(0),
  assessmentScore: real('assessment_score').notNull().default(0),
  confidenceScore: real('confidence_score').notNull().default(0),
  consistencyScore: real('consistency_score').notNull().default(0),
  lastPracticedAt: integer('last_practiced_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Learning Sessions
export const learningSessions = sqliteTable('learning_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').notNull(), // 'english' | 'coding'
  category: text('category').notNull(), // vocabulary, grammar, algorithms, etc
  topic: text('topic'),
  durationMinutes: integer('duration_minutes').notNull(),
  difficulty: text('difficulty'), // 'easy' | 'medium' | 'hard'
  language: text('language'), // for coding: 'typescript', 'python', etc
  projectId: integer('project_id'),
  source: text('source'),
  notes: text('notes'),
  wordsLearned: integer('words_learned').notNull().default(0),
  exercisesCompleted: integer('exercises_completed').notNull().default(0),
  rating: integer('rating'), // 1-5 subjective rating
  xpAwarded: integer('xp_awarded').notNull().default(0),
  date: integer('date', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Session Skills (many-to-many relationship)
export const sessionSkills = sqliteTable('session_skills', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull().references(() => learningSessions.id),
  skillId: integer('skill_id').notNull().references(() => skills.id),
});

// Projects
export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  language: text('language'),
  status: text('status').notNull().default('in_progress'), // 'not_started' | 'in_progress' | 'completed' | 'paused'
  difficulty: text('difficulty'),
  githubUrl: text('github_url'),
  githubRepoId: integer('github_repo_id'),
  totalHours: real('total_hours').notNull().default(0),
  completionPercent: integer('completion_percent').notNull().default(0),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Project Skills (many-to-many)
export const projectSkills = sqliteTable('project_skills', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull().references(() => projects.id),
  skillId: integer('skill_id').notNull().references(() => skills.id),
});

// Coding Tasks
export const codingTasks = sqliteTable('coding_tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description'),
  type: text('type').notNull(), // 'algorithm' | 'exercise' | 'project' | 'bug_fix' | 'refactor'
  difficulty: text('difficulty').notNull(), // 'easy' | 'medium' | 'hard'
  status: text('status').notNull().default('not_started'),
  language: text('language'),
  topics: text('topics'), // JSON array
  solutionUrl: text('solution_url'),
  timeSpentMinutes: integer('time_spent_minutes').notNull().default(0),
  attempts: integer('attempts').notNull().default(0),
  solvedAt: integer('solved_at', { mode: 'timestamp' }),
  nextReviewAt: integer('next_review_at', { mode: 'timestamp' }),
  confidenceLevel: integer('confidence_level'), // 1-5
  notes: text('notes'),
  projectId: integer('project_id').references(() => projects.id),
  xpAwarded: integer('xp_awarded').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const codingTaskReviews = sqliteTable('coding_task_reviews', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  taskId: integer('task_id').notNull().references(() => codingTasks.id),
  outcome: text('outcome').notNull(), // solved | hint | viewed_solution | failed | repeat
  confidence: integer('confidence'),
  notes: text('notes'),
  reviewedAt: integer('reviewed_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Programming notes: a prompt/question is stored separately from its answer.
export const codingNotes = sqliteTable('coding_notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  prompt: text('prompt').notNull(),
  answer: text('answer').notNull(),
  language: text('language'),
  topic: text('topic'),
  tags: text('tags'),
  status: text('status').notNull().default('learning'), // learning | reviewing | mastered
  correctCount: integer('correct_count').notNull().default(0),
  incorrectCount: integer('incorrect_count').notNull().default(0),
  easeFactor: real('ease_factor').notNull().default(2.5),
  interval: integer('interval').notNull().default(0),
  nextReviewAt: integer('next_review_at', { mode: 'timestamp' }),
  lastReviewedAt: integer('last_reviewed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const codingNoteReviews = sqliteTable('coding_note_reviews', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  noteId: integer('note_id').notNull().references(() => codingNotes.id),
  quality: integer('quality').notNull(),
  previousInterval: integer('previous_interval').notNull(),
  newInterval: integer('new_interval').notNull(),
  reviewedAt: integer('reviewed_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// LeetCode Tasks
export const leetcodeTasks = sqliteTable('leetcode_tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  leetcodeId: text('leetcode_id').unique(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  difficulty: text('difficulty').notNull(), // 'Easy' | 'Medium' | 'Hard'
  topics: text('topics'), // JSON array
  status: text('status').notNull().default('not_started'),
  solvedAt: integer('solved_at', { mode: 'timestamp' }),
  language: text('language'),
  attempts: integer('attempts').notNull().default(0),
  solutionUrl: text('solution_url'),
  nextReviewAt: integer('next_review_at', { mode: 'timestamp' }),
  confidenceLevel: integer('confidence_level'),
  notes: text('notes'),
  xpAwarded: integer('xp_awarded').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// English Words
export const englishWords = sqliteTable('english_words', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  word: text('word').notNull(),
  wordKey: text('word_key'),
  translation: text('translation').notNull(),
  definition: text('definition'),
  example: text('example'),
  partOfSpeech: text('part_of_speech'),
  pronunciation: text('pronunciation'),
  audioUrl: text('audio_url'),
  tags: text('tags'), // JSON array
  category: text('category'),
  status: text('status').notNull().default('learning'), // 'learning' | 'reviewing' | 'mastered'
  correctCount: integer('correct_count').notNull().default(0),
  incorrectCount: integer('incorrect_count').notNull().default(0),
  easeFactor: real('ease_factor').notNull().default(2.5),
  interval: integer('interval').notNull().default(0),
  nextReviewAt: integer('next_review_at', { mode: 'timestamp' }),
  lastReviewedAt: integer('last_reviewed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  wordKeyUniqueIdx: uniqueIndex('english_words_word_key_idx').on(table.wordKey),
}));

// Word Reviews
export const wordReviews = sqliteTable('word_reviews', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  wordId: integer('word_id').notNull().references(() => englishWords.id),
  quality: integer('quality').notNull(), // 0-5 (SM-2 algorithm)
  previousInterval: integer('previous_interval').notNull(),
  newInterval: integer('new_interval').notNull(),
  reviewedAt: integer('reviewed_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Goals
export const goals = sqliteTable('goals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description'),
  type: text('type').notNull(), // 'time' | 'count' | 'skill_level' | 'custom'
  category: text('category').notNull(), // 'english' | 'coding' | 'leetcode' | 'github' | 'general'
  targetValue: real('target_value').notNull(),
  currentValue: real('current_value').notNull().default(0),
  unit: text('unit').notNull(), // 'hours' | 'tasks' | 'words' | 'commits'
  timeframe: text('timeframe').notNull(), // 'daily' | 'weekly' | 'monthly' | 'custom'
  priority: text('priority').notNull().default('medium'), // 'low' | 'medium' | 'high'
  deadline: integer('deadline', { mode: 'timestamp' }),
  status: text('status').notNull().default('active'), // 'active' | 'completed' | 'paused' | 'failed'
  xpReward: integer('xp_reward').notNull().default(0),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Goal Skills (many-to-many)
export const goalSkills = sqliteTable('goal_skills', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  goalId: integer('goal_id').notNull().references(() => goals.id),
  skillId: integer('skill_id').notNull().references(() => skills.id),
});

// Achievements
export const achievements = sqliteTable('achievements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  icon: text('icon').notNull(),
  rarity: text('rarity').notNull().default('common'), // 'common' | 'rare' | 'epic' | 'legendary'
  category: text('category').notNull(),
  isSecret: integer('is_secret', { mode: 'boolean' }).notNull().default(false),
  xpReward: integer('xp_reward').notNull().default(0),
  condition: text('condition').notNull(), // JSON with condition logic
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// User Achievements
export const userAchievements = sqliteTable('user_achievements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  achievementId: integer('achievement_id').notNull().references(() => achievements.id),
  unlockedAt: integer('unlocked_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  progress: real('progress').notNull().default(0),
  isUnlocked: integer('is_unlocked', { mode: 'boolean' }).notNull().default(false),
}, (table) => ({
  achievementOnce: uniqueIndex('user_achievements_once_idx').on(table.achievementId),
}));

// Quests
export const quests = sqliteTable('quests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  type: text('type').notNull(), // 'daily' | 'weekly' | 'milestone'
  category: text('category').notNull(),
  targetValue: real('target_value').notNull(),
  currentValue: real('current_value').notNull().default(0),
  unit: text('unit').notNull(),
  difficulty: text('difficulty').notNull().default('medium'),
  xpReward: integer('xp_reward').notNull(),
  status: text('status').notNull().default('active'), // 'active' | 'completed' | 'expired'
  startDate: integer('start_date', { mode: 'timestamp' }).notNull(),
  endDate: integer('end_date', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// XP Transactions
export const xpTransactions = sqliteTable('xp_transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  amount: integer('amount').notNull(),
  source: text('source').notNull(), // 'session' | 'goal' | 'achievement' | 'quest' | 'manual'
  sourceId: integer('source_id'),
  description: text('description').notNull(),
  skillId: integer('skill_id').references(() => skills.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Daily Statistics
export const dailyStatistics = sqliteTable('daily_statistics', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull().unique(), // YYYY-MM-DD
  totalMinutes: integer('total_minutes').notNull().default(0),
  englishMinutes: integer('english_minutes').notNull().default(0),
  codingMinutes: integer('coding_minutes').notNull().default(0),
  sessionsCount: integer('sessions_count').notNull().default(0),
  tasksCompleted: integer('tasks_completed').notNull().default(0),
  wordsReviewed: integer('words_reviewed').notNull().default(0),
  xpEarned: integer('xp_earned').notNull().default(0),
  goalsCompleted: integer('goals_completed').notNull().default(0),
  achievementsUnlocked: integer('achievements_unlocked').notNull().default(0),
  githubCommits: integer('github_commits').notNull().default(0),
  leetcodeSolved: integer('leetcode_solved').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// GitHub Integration
export const githubIntegration = sqliteTable('github_integration', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull(),
  isConnected: integer('is_connected', { mode: 'boolean' }).notNull().default(true),
  lastSyncAt: integer('last_sync_at', { mode: 'timestamp' }),
  totalRepos: integer('total_repos').notNull().default(0),
  totalCommits: integer('total_commits').notNull().default(0),
  syncError: text('sync_error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// GitHub Repositories
export const githubRepositories = sqliteTable('github_repositories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  githubId: integer('github_id').notNull().unique(),
  name: text('name').notNull(),
  fullName: text('full_name').notNull(),
  description: text('description'),
  language: text('language'),
  isPrivate: integer('is_private', { mode: 'boolean' }).notNull().default(false),
  isFork: integer('is_fork', { mode: 'boolean' }).notNull().default(false),
  isTracked: integer('is_tracked', { mode: 'boolean' }).notNull().default(false),
  htmlUrl: text('html_url').notNull(),
  projectId: integer('project_id').references(() => projects.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  pushedAt: integer('pushed_at', { mode: 'timestamp' }),
  syncedAt: integer('synced_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// GitHub Activity
export const githubActivity = sqliteTable('github_activity', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull(), // YYYY-MM-DD
  commits: integer('commits').notNull().default(0),
  pullRequests: integer('pull_requests').notNull().default(0),
  issues: integer('issues').notNull().default(0),
  repositories: text('repositories'), // JSON array of repo names
  syncedAt: integer('synced_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  activityDateUnique: uniqueIndex('github_activity_date_unique_idx').on(table.date),
}));

// LeetCode Integration
export const leetcodeIntegration = sqliteTable('leetcode_integration', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull(),
  isConnected: integer('is_connected', { mode: 'boolean' }).notNull().default(true),
  lastSyncAt: integer('last_sync_at', { mode: 'timestamp' }),
  totalSolved: integer('total_solved').notNull().default(0),
  easySolved: integer('easy_solved').notNull().default(0),
  mediumSolved: integer('medium_solved').notNull().default(0),
  hardSolved: integer('hard_solved').notNull().default(0),
  ranking: integer('ranking'),
  syncError: text('sync_error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const githubContributionDays = sqliteTable('github_contribution_days', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull(),
  date: text('date').notNull(),
  contributionCount: integer('contribution_count').notNull(),
  source: text('source').notNull(), // github-graphql | github-public-events
  syncedAt: integer('synced_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (table) => ({
  usernameDateUnique: uniqueIndex('github_contribution_username_date_idx').on(table.username, table.date),
}));

export const leetcodeSnapshots = sqliteTable('leetcode_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull(),
  totalSolved: integer('total_solved').notNull(),
  easySolved: integer('easy_solved').notNull(),
  mediumSolved: integer('medium_solved').notNull(),
  hardSolved: integer('hard_solved').notNull(),
  totalQuestions: integer('total_questions'),
  ranking: integer('ranking'),
  source: text('source').notNull().default('leetcode-public-graphql'),
  capturedAt: integer('captured_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Journal Entries
export const journalEntries = sqliteTable('journal_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull(), // YYYY-MM-DD
  title: text('title'),
  content: text('content').notNull(),
  tags: text('tags'), // JSON array
  mood: text('mood'),
  learned: text('learned'),
  challenges: text('challenges'),
  plans: text('plans'),
  autoGenerated: integer('auto_generated', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Seasons
export const seasons = sqliteTable('seasons', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  duration: integer('duration').notNull(), // days
  startDate: integer('start_date', { mode: 'timestamp' }).notNull(),
  endDate: integer('end_date', { mode: 'timestamp' }).notNull(),
  status: text('status').notNull().default('active'), // 'active' | 'completed'
  startLevel: integer('start_level').notNull(),
  endLevel: integer('end_level'),
  startXp: integer('start_xp').notNull(),
  endXp: integer('end_xp'),
  totalHours: real('total_hours').notNull().default(0),
  tasksCompleted: integer('tasks_completed').notNull().default(0),
  goalsCompleted: integer('goals_completed').notNull().default(0),
  achievementsUnlocked: integer('achievements_unlocked').notNull().default(0),
  summary: text('summary'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

// App Settings
export const appSettings = sqliteTable('app_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  type: text('type').notNull(), // 'string' | 'number' | 'boolean' | 'json'
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});
